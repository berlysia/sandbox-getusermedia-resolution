import {
  ChangeEventHandler,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

interface DeviceDetailInfo {
  deviceInfo: MediaDeviceInfo;
  capabilities?: MediaTrackCapabilities;
}

const CameraApp = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [resolution, setResolution] = useState({ width: 640, height: 480 });
  const [trackCorrespondences, setTrackCorrespondences] = useState({});
  const [useMaxResolution, setUseMaxResolution] = useState(false);
  const [maxResolution, setMaxResolution] = useState({ width: 0, height: 0 });
  const [useMinResolution, setUseMinResolution] = useState(false);
  const [minResolution, setMinResolution] = useState({ width: 0, height: 0 });
  // 利用可能な幅と高さの範囲
  const [widthRange, setWidthRange] = useState<{ min?: number; max?: number }>({});
  const [heightRange, setHeightRange] = useState<{ min?: number; max?: number }>({});
  const [error, setError] = useState("");
  const [actualResolution, setActualResolution] = useState({
    width: 0,
    height: 0,
  });
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceDetails, setDeviceDetails] = useState<DeviceDetailInfo[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState("");
  const [selectedAudioDevice, setSelectedAudioDevice] = useState("");
  const [facingMode, setFacingMode] = useState("");
  const [availableFacingModes, setAvailableFacingModes] = useState<string[]>(
    [],
  );

  const fetchDevices = async () => {
    try {
      setLoadingDevices(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      const deviceInfos = await navigator.mediaDevices.enumerateDevices();

      // DeviceDetailInfoオブジェクトを作成
      const detailInfos: DeviceDetailInfo[] = deviceInfos.map((deviceInfo) => {
        // videoinputまたはaudioinputのデバイスに対応するトラックを探す
        let capabilities: MediaTrackCapabilities | undefined = undefined;

        if (deviceInfo instanceof InputDeviceInfo) {
          capabilities = deviceInfo.getCapabilities();
        }

        return {
          deviceInfo,
          capabilities,
        };
      });

      // トラックを停止
      for (const track of stream.getTracks()) {
        track.stop();
      }

      setDeviceDetails(detailInfos);
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

    // デバイス変更時にcapabilitiesに基づいて設定を更新
    updateDeviceCapabilitiesOptions(deviceId);
  };

  // デバイスが変更されたときにcapabilities情報に基づいて設定を更新
  const updateDeviceCapabilitiesOptions = useCallback(
    (deviceId: string) => {
      if (!deviceId) {
        // デバイスが選択されていない場合は設定をクリア
        setAvailableFacingModes([]);
        setFacingMode("");
        setWidthRange({});
        setHeightRange({});
        return;
      }

      const selectedDevice = deviceDetails.find(
        (detail) => detail.deviceInfo.deviceId === deviceId,
      );

      const capabilities = selectedDevice?.capabilities;
      if (!capabilities) {
        // 選択されたデバイスのcapabilitiesがなければ設定をクリア
        setAvailableFacingModes([]);
        setFacingMode("");
        setWidthRange({});
        setHeightRange({});
        return;
      }

      // ======= facingMode の設定更新 =======
      if (capabilities.facingMode) {
        // 利用可能なfacingModeを更新
        const modes = Array.isArray(capabilities.facingMode)
          ? capabilities.facingMode
          : [];

        setAvailableFacingModes(modes);

        // 現在選択されているfacingModeが利用可能かどうかチェック
        if (facingMode && !modes.includes(facingMode)) {
          // 現在のfacingModeが利用できない場合はクリア
          setFacingMode("");
        }
      } else {
        setAvailableFacingModes([]);
        setFacingMode("");
      }

      // ======= 解像度範囲の設定更新 =======
      if (capabilities.width) {
        const width: { min?: number; max?: number } = {};
        
        if (typeof capabilities.width.min === 'number') {
          width.min = capabilities.width.min;
        }
        
        if (typeof capabilities.width.max === 'number') {
          width.max = capabilities.width.max;
        }
        
        setWidthRange(width);
      } else {
        setWidthRange({});
      }

      if (capabilities.height) {
        const height: { min?: number; max?: number } = {};
        
        if (typeof capabilities.height.min === 'number') {
          height.min = capabilities.height.min;
        }
        
        if (typeof capabilities.height.max === 'number') {
          height.max = capabilities.height.max;
        }
        
        setHeightRange(height);
      } else {
        setHeightRange({});
      }
    },
    [deviceDetails, facingMode],
  );

  // デバイスの詳細情報が更新されたとき、選択されているデバイスのcapabilities情報を更新
  useEffect(() => {
    if (selectedVideoDevice) {
      updateDeviceCapabilitiesOptions(selectedVideoDevice);
    }
  }, [deviceDetails, selectedVideoDevice, updateDeviceCapabilitiesOptions]);

  const getSelectedDeviceCapabilities = () => {
    if (!selectedVideoDevice) return null;

    const selectedDevice = deviceDetails.find(
      (detail) => detail.deviceInfo.deviceId === selectedVideoDevice,
    );

    return selectedDevice?.capabilities || null;
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

      // 選択されたデバイスのcapabilitiesを取得
      const deviceCapabilities = getSelectedDeviceCapabilities();

      // facingModeの指定方法を決定
      let facingModeConstraint = {};
      if (facingMode && deviceCapabilities?.facingMode) {
        // capabilitiesに含まれるfacingModeの値を確認
        const availableFacingModes = Array.isArray(
          deviceCapabilities.facingMode,
        )
          ? deviceCapabilities.facingMode
          : [];

        // 指定されたfacingModeが利用可能な場合のみ設定
        if (availableFacingModes.includes(facingMode)) {
          facingModeConstraint = { facingMode };
        }
      }

      const constraints: MediaStreamConstraints = {
        ...(selectedVideoDevice && {
          deviceId: { exact: selectedVideoDevice },
        }),
        video:
          useMaxResolution || useMinResolution
            ? {
                ...facingModeConstraint,
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
                ...facingModeConstraint,
              },
      };

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
            disabled={availableFacingModes.length === 0}
          >
            <option value="">None</option>
            {availableFacingModes.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>
        {availableFacingModes.length === 0 ? (
          <div style={{ fontSize: "0.8em", marginTop: "5px", color: "#888" }}>
            選択したデバイスではfacingModeがサポートされていません
          </div>
        ) : (
          <div style={{ fontSize: "0.8em", marginTop: "5px" }}>
            利用可能なfacingMode: {availableFacingModes.join(", ")}
          </div>
        )}
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
        {(widthRange.min !== undefined || widthRange.max !== undefined || 
          heightRange.min !== undefined || heightRange.max !== undefined) && (
          <div style={{ fontSize: "0.8em", marginTop: "5px" }}>
            利用可能な解像度範囲: 
            {widthRange.min !== undefined && ` 幅 ${widthRange.min}`}
            {widthRange.max !== undefined && ` 〜 ${widthRange.max}`}
            {heightRange.min !== undefined && `, 高さ ${heightRange.min}`}
            {heightRange.max !== undefined && ` 〜 ${heightRange.max}`}
          </div>
        )}
      </div>

      <div>
        <label>
          Use Max Resolution:
          <input
            type="checkbox"
            checked={useMaxResolution}
            onChange={(e) => {
              setUseMaxResolution(e.target.checked);
              
              // チェックされた場合、capabilitiesから取得した最大値を設定
              if (e.target.checked && widthRange.max && heightRange.max) {
                setMaxResolution({
                  width: widthRange.max,
                  height: heightRange.max,
                });
              }
            }}
          />
        </label>
        <input
          type="text"
          placeholder="width"
          value={maxResolution.width || ""}
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
          value={maxResolution.height || ""}
          disabled={!useMaxResolution}
          onChange={(e) => {
            setMaxResolution({
              width: maxResolution.width,
              height: Number(e.target.value),
            });
          }}
        />
        {useMaxResolution && widthRange.max && heightRange.max && (
          <div style={{ fontSize: "0.8em", marginTop: "5px" }}>
            サポートされている最大解像度: {widthRange.max}x{heightRange.max}
          </div>
        )}
      </div>

      <div>
        <label>
          Use Min Resolution:
          <input
            type="checkbox"
            checked={useMinResolution}
            onChange={(e) => {
              setUseMinResolution(e.target.checked);
              
              // チェックされた場合、capabilitiesから取得した最小値を設定
              if (e.target.checked && widthRange.min && heightRange.min) {
                setMinResolution({
                  width: widthRange.min,
                  height: heightRange.min,
                });
              }
            }}
          />
        </label>
        <input
          type="text"
          placeholder="width"
          value={minResolution.width || ""}
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
          value={minResolution.height || ""}
          disabled={!useMinResolution}
          onChange={(e) => {
            setMinResolution({
              width: minResolution.width,
              height: Number(e.target.value),
            });
          }}
        />
        {useMinResolution && widthRange.min && heightRange.min && (
          <div style={{ fontSize: "0.8em", marginTop: "5px" }}>
            サポートされている最小解像度: {widthRange.min}x{heightRange.min}
          </div>
        )}
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
        <h3>Device Information (enumerateDevices結果)</h3>
        <div>
          {deviceDetails.map((deviceDetail, index) => (
            <div
              key={index}
              style={{
                marginBottom: "20px",
                border: "1px solid #ccc",
                padding: "10px",
              }}
            >
              <h4>
                デバイス {index + 1}: {deviceDetail.deviceInfo.kind}
              </h4>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <tbody>
                  <tr>
                    <td
                      style={{
                        border: "1px solid #ccc",
                        padding: "5px",
                        fontWeight: "bold",
                      }}
                    >
                      deviceId:
                    </td>
                    <td style={{ border: "1px solid #ccc", padding: "5px" }}>
                      {deviceDetail.deviceInfo.deviceId}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        border: "1px solid #ccc",
                        padding: "5px",
                        fontWeight: "bold",
                      }}
                    >
                      groupId:
                    </td>
                    <td style={{ border: "1px solid #ccc", padding: "5px" }}>
                      {deviceDetail.deviceInfo.groupId}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        border: "1px solid #ccc",
                        padding: "5px",
                        fontWeight: "bold",
                      }}
                    >
                      label:
                    </td>
                    <td style={{ border: "1px solid #ccc", padding: "5px" }}>
                      {deviceDetail.deviceInfo.label || "ラベルなし"}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        border: "1px solid #ccc",
                        padding: "5px",
                        fontWeight: "bold",
                      }}
                    >
                      kind:
                    </td>
                    <td style={{ border: "1px solid #ccc", padding: "5px" }}>
                      {deviceDetail.deviceInfo.kind}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        border: "1px solid #ccc",
                        padding: "5px",
                        fontWeight: "bold",
                      }}
                    >
                      capabilities:
                    </td>
                    <td style={{ border: "1px solid #ccc", padding: "5px" }}>
                      {deviceDetail.capabilities ? (
                        <pre
                          style={{
                            whiteSpace: "pre-wrap",
                            maxHeight: "300px",
                            overflow: "auto",
                          }}
                        >
                          {JSON.stringify(deviceDetail.capabilities, null, 2)}
                        </pre>
                      ) : (
                        "取得できませんでした"
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <h3>Track Information</h3>
        <pre>{JSON.stringify(trackCorrespondences, null, 2)}</pre>
      </div>
    </div>
  );
};

export default CameraApp;
