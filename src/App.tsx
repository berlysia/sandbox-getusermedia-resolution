import { ChangeEventHandler, useEffect, useRef, useState } from "react";

const CameraApp = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [resolution, setResolution] = useState({ width: 640, height: 480 });
  const [useMaxResolution, setUseMaxResolution] = useState(false);
  const [maxResolution, setMaxResolution] = useState({ width: 0, height: 0 });
  const [useMinResolution, setUseMinResolution] = useState(false);
  const [minResolution, setMinResolution] = useState({ width: 0, height: 0 });
  const [error, setError] = useState("");
  const [actualResolution, setActualResolution] = useState({
    width: 0,
    height: 0,
  });
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState("");

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const deviceInfos = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = deviceInfos.filter(
          (device) => device.kind === "videoinput",
        );
        setDevices(videoDevices);
        if (videoDevices.length > 0) {
          setSelectedDevice(videoDevices[0].deviceId);
        }
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        }
      }
    };

    fetchDevices();
  }, []);

  const handleDeviceChange: ChangeEventHandler<HTMLSelectElement> = (event) => {
    setSelectedDevice(event.currentTarget.value);
    stopStream();
  };

  const startStream = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("getUserMedia is not supported in this browser.");
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        ...(selectedDevice && { deviceId: { exact: selectedDevice } }),
        video:
          useMaxResolution || useMinResolution
            ? {
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
            : { width: resolution.width, height: resolution.height },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

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
    }
  };

  const handleResolutionChange: ChangeEventHandler<HTMLSelectElement> = (
    event,
  ) => {
    const [width, height] = event.currentTarget.value.split("x").map(Number);
    setResolution({ width, height });
    stopStream();
  };

  return (
    <div>
      <h1>Camera Stream with Resolution Adjustment</h1>

      <div>
        <label htmlFor="device">Select Camera: </label>
        <select
          id="device"
          onChange={handleDeviceChange}
          value={selectedDevice || ""}
        >
          {devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Camera ${device.deviceId}`}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="resolution">Select Resolution: </label>
        <select
          id="resolution"
          onChange={handleResolutionChange}
          defaultValue="640x480"
        >
          <option value="640x480">640x480</option>
          <option value="1280x720">1280x720</option>
          <option value="1920x1080">1920x1080</option>
        </select>
      </div>
      <div>
        <label htmlFor="resolution">Custom Resolution: </label>
        <input
          type="text"
          placeholder="width"
          onChange={(e) => {
            setResolution({
              width: Number(e.target.value),
              height: resolution.height,
            });
          }}
        />
        <input
          type="text"
          placeholder="height"
          onChange={(e) => {
            setResolution({
              width: resolution.width,
              height: Number(e.target.value),
            });
          }}
        />
      </div>

      <div>
        <label htmlFor="maxResolution">Use Max Resolution: </label>
        <input
          type="checkbox"
          id="maxResolution"
          checked={useMaxResolution}
          onChange={(e) => {
            setUseMaxResolution(e.target.checked);
            if (e.target.checked) {
              setResolution(maxResolution);
            }
          }}
        />
        {useMaxResolution && (
          <div>
            <input
              type="text"
              placeholder="width"
              onChange={(e) => {
                setMaxResolution({
                  width: Number(e.target.value),
                  height: maxResolution.height,
                });
              }}
            />
            <input
              type="text"
              placeholder="height"
              onChange={(e) => {
                setMaxResolution({
                  width: maxResolution.width,
                  height: Number(e.target.value),
                });
              }}
            />
          </div>
        )}
      </div>

      <div>
        <label htmlFor="minResolution">Use Min Resolution: </label>
        <input
          type="checkbox"
          id="minResolution"
          checked={useMinResolution}
          onChange={(e) => {
            setUseMinResolution(e.target.checked);
            if (e.target.checked) {
              setResolution(minResolution);
            }
          }}
        />
        {useMinResolution && (
          <div>
            <input
              type="text"
              placeholder="width"
              onChange={(e) => {
                setMinResolution({
                  width: Number(e.target.value),
                  height: minResolution.height,
                });
              }}
            />
            <input
              type="text"
              placeholder="height"
              onChange={(e) => {
                setMinResolution({
                  width: minResolution.width,
                  height: Number(e.target.value),
                });
              }}
            />
          </div>
        )}
      </div>

      <div>
        <button onClick={startStream}>Start Camera</button>
        <button onClick={stopStream}>Stop Camera</button>
      </div>

      <div>
        <p>
          requested resolution: {resolution.width}x{resolution.height}
        </p>
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
    </div>
  );
};

export default CameraApp;
