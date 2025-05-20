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

// カスタム制約を保存するための型
interface CustomConstraints {
  [key: string]: any;
}

const CameraApp = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [trackCorrespondences, setTrackCorrespondences] = useState({});
  const [error, setError] = useState("");
  const [actualResolution, setActualResolution] = useState({
    width: 0,
    height: 0,
  });
  // ストリームから取得された実際のデバイスID
  const [actualDeviceId, setActualDeviceId] = useState<string | null>(null);
  // デバイスID一致確認の結果
  const [deviceIdMatch, setDeviceIdMatch] = useState<boolean | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceDetails, setDeviceDetails] = useState<DeviceDetailInfo[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState("");
  const [selectedAudioDevice, setSelectedAudioDevice] = useState("");

  // カスタム制約の状態
  const [customConstraints, setCustomConstraints] = useState<CustomConstraints>(
    {
      // 解像度の初期値を設定
      width: { ideal: 640 },
      height: { ideal: 480 },
    },
  );
  // 選択されたデバイスの能力
  const [currentCapabilities, setCurrentCapabilities] =
    useState<MediaTrackCapabilities | null>(null);
  // アクティブな制約設定
  const [activeConstraintKeys, setActiveConstraintKeys] = useState<string[]>(
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

  // 選択されたデバイスのcapabilitiesを取得
  const getDeviceCapabilities = useCallback(
    (deviceId: string) => {
      if (!deviceId) return null;

      const selectedDevice = deviceDetails.find(
        (detail) => detail.deviceInfo.deviceId === deviceId,
      );

      return selectedDevice?.capabilities || null;
    },
    [deviceDetails],
  );

  // deviceIdとcapabilitiesのマッピングを作成
  useEffect(() => {
    if (selectedVideoDevice) {
      const capabilities = getDeviceCapabilities(selectedVideoDevice);
      setCurrentCapabilities(capabilities);

      if (capabilities) {
        // capabilitiesからアクティブな制約キーを抽出
        let keys = Object.keys(capabilities).filter((key) => {
          const value = capabilities[key as keyof MediaTrackCapabilities];
          return value !== undefined && key !== "deviceId" && key !== "groupId";
        });

        // width, height, facingModeを優先して並べ替え
        const priorityKeys = ["width", "height", "facingMode"];
        keys = [
          ...priorityKeys.filter((key) => keys.includes(key)),
          ...keys.filter((key) => !priorityKeys.includes(key)),
        ];

        setActiveConstraintKeys(keys);

        // カスタム制約の初期値を設定
        const initialConstraints: CustomConstraints = {};

        // 既存の解像度設定を保持
        const savedWidthConstraint = customConstraints.width;
        const savedHeightConstraint = customConstraints.height;
        const savedFacingModeConstraint = customConstraints.facingMode;

        keys.forEach((key) => {
          const value = capabilities[key as keyof MediaTrackCapabilities];

          // width, height, facingModeは設定を有効にする
          if (key === "width") {
            if (savedWidthConstraint) {
              initialConstraints[key] = savedWidthConstraint;
            } else if (keys.includes("width")) {
              initialConstraints[key] = { ideal: 640 };
            }
          } else if (key === "height") {
            if (savedHeightConstraint) {
              initialConstraints[key] = savedHeightConstraint;
            } else if (keys.includes("height")) {
              initialConstraints[key] = { ideal: 480 };
            }
          } else if (key === "facingMode") {
            if (savedFacingModeConstraint) {
              initialConstraints[key] = savedFacingModeConstraint;
            } else if (Array.isArray(value) && value.length > 0) {
              initialConstraints[key] = { ideal: value[0] };
            }
          }
          // その他のプロパティは初期値を未指定にする（設定なし）
        });

        // デバイスを変更しても解像度は640x480を保持
        if (!initialConstraints.width && keys.includes("width")) {
          initialConstraints.width = { ideal: 640 };
        }
        if (!initialConstraints.height && keys.includes("height")) {
          initialConstraints.height = { ideal: 480 };
        }

        setCustomConstraints(initialConstraints);
      } else {
        // capabilitiesがない場合でも基本的な解像度設定は保持
        setActiveConstraintKeys([]);
        setCustomConstraints({
          width: { ideal: 640 },
          height: { ideal: 480 },
          // facingModeは設定しない（デバイスによって異なるため）
        });
      }
    }
  }, [
    selectedVideoDevice,
    deviceDetails,
    getDeviceCapabilities,
    customConstraints.width,
    customConstraints.height,
  ]);

  // デバイス変更時の処理
  const handleVideoDeviceChange: ChangeEventHandler<HTMLSelectElement> = (
    event,
  ) => {
    const deviceId = event.currentTarget.value;
    setSelectedVideoDevice(deviceId);
  };

  // デバイスIDのexact指定を制御する状態
  const [useExactDeviceId, setUseExactDeviceId] = useState(true);
  const [useExactAudioDeviceId, setUseExactAudioDeviceId] = useState(true);

  // 制約オブジェクトを構築
  const buildConstraints = useCallback(() => {
    // ビデオ制約を構築
    const videoConstraints: Record<string, any> = {};

    // deviceIdの設定（exact指定のトグル対応）
    if (selectedVideoDevice) {
      videoConstraints.deviceId = useExactDeviceId
        ? { exact: selectedVideoDevice }
        : { ideal: selectedVideoDevice };
    }

    // カスタム制約の追加
    activeConstraintKeys.forEach((key) => {
      if (customConstraints[key] !== undefined) {
        videoConstraints[key] = customConstraints[key];
      }
    });

    // オーディオ制約を構築
    let audioConstraints: boolean | MediaTrackConstraints = false;
    if (selectedAudioDevice) {
      audioConstraints = {
        deviceId: useExactAudioDeviceId
          ? { exact: selectedAudioDevice }
          : { ideal: selectedAudioDevice },
      };
    }

    return {
      video: Object.keys(videoConstraints).length > 0 ? videoConstraints : true,
      audio: audioConstraints,
    };
  }, [
    selectedVideoDevice,
    activeConstraintKeys,
    selectedAudioDevice,
    useExactDeviceId,
    customConstraints,
    useExactAudioDeviceId,
  ]);

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

      const constraints = buildConstraints();

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // トラック情報の処理
      for (const track of stream.getTracks()) {
        const settings = track.getSettings();

        if (track.kind === "video") {
          // ビデオトラックの場合はデバイスIDを抽出
          const trackDeviceId = settings.deviceId;
          setActualDeviceId(trackDeviceId || null);

          // 指定したデバイスIDと実際のデバイスIDの一致を確認
          if (selectedVideoDevice && trackDeviceId) {
            setDeviceIdMatch(selectedVideoDevice === trackDeviceId);
          } else {
            setDeviceIdMatch(null);
          }
        }

        // トラック情報を保存
        setTrackCorrespondences({
          capabilities: track.getCapabilities(),
          constraints: track.getConstraints(),
          settings: settings,
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

      // ストリーム停止時にデバイスID関連の状態をリセット
      setActualDeviceId(null);
      setDeviceIdMatch(null);

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
        {selectedVideoDevice && (
          <div style={{ marginTop: "5px", marginLeft: "10px" }}>
            <label>
              <input
                type="checkbox"
                checked={useExactDeviceId}
                onChange={(e) => setUseExactDeviceId(e.target.checked)}
              />
              <span style={{ fontSize: "0.9em", marginLeft: "5px" }}>
                deviceIdをexactに設定
              </span>
            </label>
          </div>
        )}
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
        {selectedAudioDevice && (
          <div style={{ marginTop: "5px", marginLeft: "10px" }}>
            <label>
              <input
                type="checkbox"
                checked={useExactAudioDeviceId}
                onChange={(e) => setUseExactAudioDeviceId(e.target.checked)}
              />
              <span style={{ fontSize: "0.9em", marginLeft: "5px" }}>
                deviceIdをexactに設定
              </span>
            </label>
          </div>
        )}
      </div>

      <div>
        <button type="button" onClick={fetchDevices}>
          Reload Devices
        </button>
      </div>

      {/* Capabilities フォーム */}
      {activeConstraintKeys.length > 0 && (
        <div
          style={{
            marginTop: "20px",
            border: "1px solid #ddd",
            padding: "10px",
            borderRadius: "5px",
          }}
        >
          <h3>カメラ制約の設定</h3>
          <p style={{ fontSize: "0.8em", marginBottom: "10px" }}>
            選択したデバイスでサポートされている各種パラメータを設定できます
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
              gap: "15px",
            }}
          >
            {activeConstraintKeys.map((key) => {
              const capValue =
                currentCapabilities?.[key as keyof MediaTrackCapabilities];

              if (!capValue) return null;

              // 値に応じたコントロールを表示
              return (
                <div
                  key={key}
                  style={{
                    border: "1px solid #eee",
                    padding: "10px",
                    borderRadius: "4px",
                    backgroundColor: "#f9f9f9",
                  }}
                >
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "1em" }}>
                    {key}
                  </h4>

                  {/* 配列（facingModeなど）の場合はセレクトボックス */}
                  {Array.isArray(capValue) && (
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          marginBottom: "5px",
                        }}
                      >
                        <label
                          style={{
                            display: "block",
                            fontSize: "0.8em",
                            marginRight: "10px",
                            flex: "1",
                          }}
                        >
                          値
                        </label>
                        {/* 配列要素が真偽値の場合を除いて、有効・無効の切り替えを表示 */}
                        {!(
                          capValue.length === 2 &&
                          typeof capValue[0] === "boolean"
                        ) && (
                          <label style={{ fontSize: "0.8em" }}>
                            <input
                              type="checkbox"
                              checked={customConstraints[key] !== undefined}
                              onChange={(e) => {
                                if (!e.target.checked) {
                                  // 値を未指定に（キー自体を削除）
                                  const newConstraints = {
                                    ...customConstraints,
                                  };
                                  delete newConstraints[key];
                                  setCustomConstraints(newConstraints);
                                } else if (capValue.length > 0) {
                                  // デフォルト値を設定
                                  setCustomConstraints({
                                    ...customConstraints,
                                    [key]: { ideal: String(capValue[0]) },
                                  });
                                }
                              }}
                            />
                            <span style={{ marginLeft: "5px" }}>有効</span>
                          </label>
                        )}
                      </div>
                      <select
                        value={
                          customConstraints[key]?.exact ||
                          customConstraints[key]?.ideal ||
                          ""
                        }
                        onChange={(e) => {
                          const value = e.target.value;
                          setCustomConstraints({
                            ...customConstraints,
                            [key]: value ? { ideal: value } : undefined,
                          });
                        }}
                        style={{ width: "100%" }}
                        disabled={
                          customConstraints[key] === undefined ||
                          capValue.length === 0
                        }
                      >
                        <option value="">指定なし</option>
                        {capValue.map((val) => (
                          <option key={String(val)} value={String(val)}>
                            {val}
                          </option>
                        ))}
                      </select>
                      {capValue.length === 0 && (
                        <div
                          style={{
                            fontSize: "0.8em",
                            color: "#888",
                            marginTop: "3px",
                          }}
                        >
                          選択肢がありません
                        </div>
                      )}

                      {customConstraints[key] !== undefined &&
                        capValue.length > 0 &&
                        !(
                          capValue.length === 2 &&
                          typeof capValue[0] === "boolean"
                        ) && (
                          <div style={{ marginTop: "5px" }}>
                            <label>
                              <input
                                type="checkbox"
                                checked={!!customConstraints[key]?.exact}
                                onChange={(e) => {
                                  const value =
                                    customConstraints[key]?.ideal ||
                                    customConstraints[key]?.exact;
                                  if (e.target.checked) {
                                    setCustomConstraints({
                                      ...customConstraints,
                                      [key]: { exact: value },
                                    });
                                  } else {
                                    setCustomConstraints({
                                      ...customConstraints,
                                      [key]: { ideal: value },
                                    });
                                  }
                                }}
                              />
                              <span
                                style={{ fontSize: "0.8em", marginLeft: "5px" }}
                              >
                                exactに設定
                              </span>
                            </label>
                          </div>
                        )}
                    </div>
                  )}

                  {/* 範囲値（width, height, frameRateなど）の場合 */}
                  {!Array.isArray(capValue) &&
                    typeof capValue === "object" &&
                    capValue !== null &&
                    ("min" in capValue || "max" in capValue) && (
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            marginBottom: "5px",
                          }}
                        >
                          <label
                            style={{
                              display: "block",
                              fontSize: "0.8em",
                              marginRight: "10px",
                              flex: "1",
                            }}
                          >
                            理想値
                          </label>
                          <label style={{ fontSize: "0.8em" }}>
                            <input
                              type="checkbox"
                              checked={customConstraints[key] !== undefined}
                              onChange={(e) => {
                                if (!e.target.checked) {
                                  // 値を未指定に（キー自体を削除）
                                  const newConstraints = {
                                    ...customConstraints,
                                  };
                                  delete newConstraints[key];
                                  setCustomConstraints(newConstraints);
                                } else {
                                  // デフォルト値を設定
                                  const defaultValue =
                                    capValue.min !== undefined
                                      ? capValue.min
                                      : 0;
                                  setCustomConstraints({
                                    ...customConstraints,
                                    [key]: { ideal: defaultValue },
                                  });
                                }
                              }}
                            />
                            <span style={{ marginLeft: "5px" }}>有効</span>
                          </label>
                        </div>
                        <input
                          type="range"
                          min={capValue.min !== undefined ? capValue.min : 0}
                          max={capValue.max !== undefined ? capValue.max : 100}
                          step={
                            capValue.max &&
                            capValue.min &&
                            capValue.max - capValue.min > 100
                              ? (capValue.max - capValue.min) / 100
                              : 1
                          }
                          value={
                            customConstraints[key]?.ideal ||
                            customConstraints[key]?.exact ||
                            (capValue.min !== undefined ? capValue.min : 0)
                          }
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            setCustomConstraints({
                              ...customConstraints,
                              [key]: {
                                ...(customConstraints[key] || {}),
                                ideal: value,
                              },
                            });
                          }}
                          style={{ width: "100%" }}
                          disabled={
                            customConstraints[key] === undefined ||
                            (capValue.min === undefined &&
                              capValue.max === undefined)
                          }
                        />
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "0.7em",
                            color: "#666",
                          }}
                        >
                          <span>
                            min:{" "}
                            {capValue.min !== undefined ? capValue.min : "N/A"}
                          </span>
                          <span>
                            max:{" "}
                            {capValue.max !== undefined ? capValue.max : "N/A"}
                          </span>
                        </div>
                        <div
                          style={{
                            textAlign: "center",
                            fontSize: "0.8em",
                            marginTop: "3px",
                          }}
                        >
                          現在値:{" "}
                          {customConstraints[key]?.ideal ||
                            customConstraints[key]?.exact ||
                            "-"}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "8px",
                            marginTop: "8px",
                          }}
                        >
                          {/* min制約 */}
                          <div style={{ flexBasis: "48%", flexGrow: 1 }}>
                            <label
                              style={{
                                display: "block",
                                fontSize: "0.8em",
                                marginBottom: "3px",
                              }}
                            >
                              最小値
                            </label>
                            <input
                              type="number"
                              min={capValue.min}
                              max={capValue.max}
                              value={customConstraints[key]?.min || ""}
                              onChange={(e) => {
                                const value =
                                  e.target.value === ""
                                    ? undefined
                                    : Number(e.target.value);
                                setCustomConstraints({
                                  ...customConstraints,
                                  [key]: {
                                    ...(customConstraints[key] || {}),
                                    min: value,
                                  },
                                });
                              }}
                              style={{ width: "100%" }}
                              disabled={
                                customConstraints[key] === undefined ||
                                (capValue.min === undefined &&
                                  capValue.max === undefined)
                              }
                            />
                          </div>

                          {/* max制約 */}
                          <div style={{ flexBasis: "48%", flexGrow: 1 }}>
                            <label
                              style={{
                                display: "block",
                                fontSize: "0.8em",
                                marginBottom: "3px",
                              }}
                            >
                              最大値
                            </label>
                            <input
                              type="number"
                              min={capValue.min}
                              max={capValue.max}
                              value={customConstraints[key]?.max || ""}
                              onChange={(e) => {
                                const value =
                                  e.target.value === ""
                                    ? undefined
                                    : Number(e.target.value);
                                setCustomConstraints({
                                  ...customConstraints,
                                  [key]: {
                                    ...(customConstraints[key] || {}),
                                    max: value,
                                  },
                                });
                              }}
                              style={{ width: "100%" }}
                              disabled={
                                customConstraints[key] === undefined ||
                                (capValue.min === undefined &&
                                  capValue.max === undefined)
                              }
                            />
                          </div>
                        </div>

                        {capValue.min === undefined &&
                          capValue.max === undefined && (
                            <div
                              style={{
                                fontSize: "0.8em",
                                color: "#888",
                                marginTop: "3px",
                              }}
                            >
                              値の範囲が未定義です
                            </div>
                          )}

                        {/* exact制約 */}
                        <div style={{ marginTop: "8px" }}>
                          <label
                            style={{
                              display: "block",
                              fontSize: "0.8em",
                              marginBottom: "3px",
                            }}
                          >
                            厳密値
                          </label>
                          <input
                            type="number"
                            min={capValue.min}
                            max={capValue.max}
                            value={customConstraints[key]?.exact || ""}
                            onChange={(e) => {
                              const value =
                                e.target.value === ""
                                  ? undefined
                                  : Number(e.target.value);
                              // exactが設定された場合は他の制約を削除
                              setCustomConstraints({
                                ...customConstraints,
                                [key]:
                                  value !== undefined ? { exact: value } : {},
                              });
                            }}
                            style={{ width: "100%" }}
                            disabled={
                              customConstraints[key] === undefined ||
                              (capValue.min === undefined &&
                                capValue.max === undefined)
                            }
                          />
                        </div>
                      </div>
                    )}

                  {/* 真偽値の場合（autoGainControl, echoCancellation など） */}
                  {Array.isArray(capValue) &&
                    capValue.length === 2 &&
                    typeof capValue[0] === "boolean" && (
                      <div>
                        <div style={{ marginTop: "5px" }}>
                          <label>
                            <input
                              type="checkbox"
                              checked={!!customConstraints[key]}
                              onChange={(e) => {
                                // チェックボックスがオンならvalueを設定、オフなら未指定にする
                                if (e.target.checked) {
                                  setCustomConstraints({
                                    ...customConstraints,
                                    [key]: true,
                                  });
                                } else {
                                  // 値を未指定にする（項目を削除）
                                  const newConstraints = {
                                    ...customConstraints,
                                  };
                                  delete newConstraints[key];
                                  setCustomConstraints(newConstraints);
                                }
                              }}
                            />
                            <span
                              style={{ fontSize: "0.9em", marginLeft: "5px" }}
                            >
                              有効にする
                            </span>
                          </label>
                        </div>
                      </div>
                    )}

                  {/* 真偽値（Boolean型）の即値の場合 */}
                  {!Array.isArray(capValue) &&
                    typeof capValue === "boolean" && (
                      <div>
                        <div style={{ marginTop: "5px" }}>
                          <label>
                            <input
                              type="checkbox"
                              checked={!!customConstraints[key]}
                              onChange={(e) => {
                                // チェックボックスがオンならvalueを設定、オフなら未設定にする
                                if (e.target.checked) {
                                  setCustomConstraints({
                                    ...customConstraints,
                                    [key]: true,
                                  });
                                } else {
                                  // 値を未指定にする（項目を削除）
                                  const newConstraints = {
                                    ...customConstraints,
                                  };
                                  delete newConstraints[key];
                                  setCustomConstraints(newConstraints);
                                }
                              }}
                            />
                            <span
                              style={{ fontSize: "0.9em", marginLeft: "5px" }}
                            >
                              有効にする
                            </span>
                          </label>
                        </div>
                        <div
                          style={{
                            fontSize: "0.8em",
                            color: "#666",
                            marginTop: "3px",
                          }}
                        >
                          デフォルト値: {capValue ? "true" : "false"}
                        </div>
                      </div>
                    )}

                  {/* その他の型の場合 */}
                  {!Array.isArray(capValue) &&
                    typeof capValue !== "boolean" &&
                    (typeof capValue !== "object" ||
                      capValue === null ||
                      (!("min" in capValue) && !("max" in capValue))) && (
                      <div style={{ fontSize: "0.8em", color: "#666" }}>
                        <div>値の型: {typeof capValue}</div>
                        <pre
                          style={{
                            backgroundColor: "#f0f0f0",
                            padding: "5px",
                            maxHeight: "100px",
                            overflow: "auto",
                            fontSize: "0.9em",
                            marginTop: "5px",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                          }}
                        >
                          {JSON.stringify(capValue, null, 2)}
                        </pre>
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginTop: "20px" }}>
        <button
          type="button"
          onClick={startStream}
          style={{
            padding: "8px 16px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "1em",
          }}
        >
          Start Camera
        </button>
        <button
          type="button"
          onClick={stopStream}
          style={{
            padding: "8px 16px",
            backgroundColor: "#f44336",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "1em",
            marginLeft: "10px",
          }}
        >
          Stop Camera
        </button>
      </div>

      <div>
        <p>
          actual resolution: {actualResolution.width}x{actualResolution.height}
        </p>

        {/* デバイスID一致確認の表示 */}
        {actualDeviceId && (
          <div
            style={{
              marginTop: "10px",
              padding: "10px",
              backgroundColor: "#f8f9fa",
              borderRadius: "4px",
            }}
          >
            <h4 style={{ margin: "0 0 8px 0", fontSize: "1em" }}>
              デバイスID確認
            </h4>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td
                    style={{
                      padding: "5px",
                      borderBottom: "1px solid #ddd",
                      fontWeight: "bold",
                    }}
                  >
                    指定したデバイスID:
                  </td>
                  <td
                    style={{
                      padding: "5px",
                      borderBottom: "1px solid #ddd",
                      fontFamily: "monospace",
                    }}
                  >
                    {selectedVideoDevice || "(なし)"}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      padding: "5px",
                      borderBottom: "1px solid #ddd",
                      fontWeight: "bold",
                    }}
                  >
                    実際のデバイスID:
                  </td>
                  <td
                    style={{
                      padding: "5px",
                      borderBottom: "1px solid #ddd",
                      fontFamily: "monospace",
                    }}
                  >
                    {actualDeviceId}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "5px", fontWeight: "bold" }}>
                    一致状態:
                  </td>
                  <td style={{ padding: "5px" }}>
                    {deviceIdMatch === null ? (
                      <span style={{ color: "#777" }}>確認不能</span>
                    ) : deviceIdMatch ? (
                      <span style={{ color: "#4CAF50", fontWeight: "bold" }}>
                        一致 ✓
                      </span>
                    ) : (
                      <span style={{ color: "#f44336", fontWeight: "bold" }}>
                        不一致 ✗
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
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
