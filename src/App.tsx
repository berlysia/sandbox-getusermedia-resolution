import { ChangeEventHandler, useRef, useState } from "react";

const CameraApp = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [resolution, setResolution] = useState({ width: 640, height: 480 });
  const [requestedConstraints, setRequestedConstraints] = useState({});
  const [trackCorrespondences, setTrackCorrespondences] = useState({});
  const [useMaxResolution, setUseMaxResolution] = useState(false);
  const [maxResolution, setMaxResolution] = useState({ width: 0, height: 0 });
  const [useMinResolution, setUseMinResolution] = useState(false);
  const [minResolution, setMinResolution] = useState({ width: 0, height: 0 });
  const [error, setError] = useState("");
  const [actualResolution, setActualResolution] = useState({
    width: 0,
    height: 0,
  });
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState("");
  const [selectedAudioDevice, setSelectedAudioDevice] = useState("");
  const [facingMode, setFacingMode] = useState("");

  const fetchDevices = async () => {
    try {
      setLoadingDevices(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      for (const track of stream.getTracks()) {
        track.stop();
      }
      const deviceInfos = await navigator.mediaDevices.enumerateDevices();
      setVideoDevices(
        deviceInfos.filter((device) => device.kind === "videoinput"),
      );
      setAudioDevices(
        deviceInfos.filter((device) => device.kind === "audioinput"),
      );
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setLoadingDevices(false);
    }
  };

  const fetchDevicesOnce = async () => {
    if (videoDevices.length > 0) {
      return;
    }
    await fetchDevices();
  };

  const handleVideoDeviceChange: ChangeEventHandler<HTMLSelectElement> = (
    event,
  ) => {
    const deviceId = event.currentTarget.value;
    setSelectedVideoDevice(deviceId);
  };

  const startStream = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("getUserMedia is not supported in this browser.");
      return;
    }

    try {
      const stopped = stopStream();
      if (stopped) {
        // 高速に停止と開始を行うとデバイスを握ったまま応答しなくなることがあった
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      const constraints: MediaStreamConstraints = {
        ...(selectedVideoDevice && {
          deviceId: { exact: selectedVideoDevice },
        }),
        video:
          useMaxResolution || useMinResolution
            ? {
                ...(facingMode && { facingMode: { exact: facingMode } }),
                width: {
                  ideal: resolution.width,
                  ...(useMaxResolution ? { max: maxResolution.width } : {}),
                  ...(useMinResolution ? { min: minResolution.width } : {}),
                },
                height: {
                  ideal: resolution.height,
                  ...(useMaxResolution ? { max: maxResolution.height } : {}),
                  ...(useMinResolution ? { min: minResolution.height } : {}),
                },
              }
            : {
                width: resolution.width,
                height: resolution.height,
                ...(facingMode && { facingMode: { exact: facingMode } }),
              },
      };

      setRequestedConstraints(constraints);

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      for (const track of stream.getTracks()) {
        setTrackCorrespondences({
          capabilities: track.getCapabilities(),
          constraints: track.getConstraints(),
          settings: track.getSettings(),
        });
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    }
  };

  const stopStream = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;

      if (stream instanceof MediaStream) {
        const tracks = stream.getTracks();
        tracks.forEach((track) => track.stop());
      }
      videoRef.current.srcObject = null;
      return true;
    }
    return false;
  };

  return (
    <div>
      <h1>Camera Stream with Resolution Adjustment</h1>
      <p>
        <a
          href="https://github.com/berlysia/sandbox-getusermedia-resolution"
          target="_blank"
          rel="noopener noreferrer"
        >
          source code
        </a>
      </p>

      <div>
        <label>
          Select Camera:
          <select
            onClick={fetchDevicesOnce}
            onChange={handleVideoDeviceChange}
            value={selectedVideoDevice || ""}
          >
            <option value="">選択してください</option>
            {loadingDevices && <option disabled>Loading...</option>}
            {videoDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${device.deviceId}`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <label>
          Select Audio:
          <select
            onClick={fetchDevicesOnce}
            onChange={(e) => setSelectedAudioDevice(e.currentTarget.value)}
            value={selectedAudioDevice || ""}
          >
            <option value="">選択してください</option>
            {loadingDevices && <option disabled>Loading...</option>}
            {audioDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Audio ${device.deviceId}`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <button type="button" onClick={fetchDevices}>
          Reload Devices
        </button>
      </div>

      <div>
        <label>
          Select Facing Mode:
          <select
            onChange={(e) => setFacingMode(e.currentTarget.value)}
            value={facingMode}
          >
            <option value="">None</option>
            <option value="user">user</option>
            <option value="environment">environment</option>
          </select>
        </label>
      </div>

      <div>
        <label>
          Select Resolution:
          <select
            id="resolution"
            onChange={(event) => {
              const [width, height] = event.currentTarget.value
                .split("x")
                .map(Number);
              setResolution({ width, height });
            }}
            defaultValue="640x480"
          >
            <option value="640x480">640x480</option>
            <option value="1280x720">1280x720</option>
            <option value="1920x1080">1920x1080</option>
          </select>
        </label>
      </div>
      <div>
        <label>
          Custom Resolution:
          <input
            type="text"
            placeholder="width"
            value={resolution.width}
            onChange={(e) => {
              setResolution({
                width: Number(e.target.value),
                height: resolution.height,
              });
            }}
          />
          x
          <input
            type="text"
            placeholder="height"
            value={resolution.height}
            onChange={(e) => {
              setResolution({
                width: resolution.width,
                height: Number(e.target.value),
              });
            }}
          />
        </label>
      </div>

      <div>
        <label>
          Use Max Resolution:
          <input
            type="checkbox"
            checked={useMaxResolution}
            onChange={(e) => {
              setUseMaxResolution(e.target.checked);
            }}
          />
        </label>
        <input
          type="text"
          placeholder="width"
          disabled={!useMaxResolution}
          onChange={(e) => {
            setMaxResolution({
              width: Number(e.target.value),
              height: maxResolution.height,
            });
          }}
        />
        x
        <input
          type="text"
          placeholder="height"
          disabled={!useMaxResolution}
          onChange={(e) => {
            setMaxResolution({
              width: maxResolution.width,
              height: Number(e.target.value),
            });
          }}
        />
      </div>

      <div>
        <label>
          Use Min Resolution:
          <input
            type="checkbox"
            checked={useMinResolution}
            onChange={(e) => {
              setUseMinResolution(e.target.checked);
            }}
          />
        </label>
        <input
          type="text"
          placeholder="width"
          disabled={!useMinResolution}
          onChange={(e) => {
            setMinResolution({
              width: Number(e.target.value),
              height: minResolution.height,
            });
          }}
        />
        x
        <input
          type="text"
          placeholder="height"
          disabled={!useMinResolution}
          onChange={(e) => {
            setMinResolution({
              width: minResolution.width,
              height: Number(e.target.value),
            });
          }}
        />
      </div>

      <div>
        <button type="button" onClick={startStream}>
          Start Camera
        </button>
        <button type="button" onClick={stopStream}>
          Stop Camera
        </button>
      </div>

      <div>
        <p>
          actual resolution: {actualResolution.width}x{actualResolution.height}
        </p>
      </div>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ marginTop: "20px", maxWidth: "100%" }}
        onPlay={() => {
          if (videoRef.current) {
            setActualResolution({
              width: videoRef.current.videoWidth,
              height: videoRef.current.videoHeight,
            });
          }
        }}
      ></video>

      <div>
        <pre>{JSON.stringify(requestedConstraints, null, 2)}</pre>
      </div>
      <div>
        <pre>{JSON.stringify(trackCorrespondences, null, 2)}</pre>
      </div>
    </div>
  );
};

export default CameraApp;
