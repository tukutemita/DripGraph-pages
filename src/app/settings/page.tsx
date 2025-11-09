import SettingsPanel from "./SettingsPanel";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">設定</h1>
        <p className="text-sm text-neutral-400">
          パスフレーズ暗号化とローカルDBエクスポートのデモビューです。
        </p>
      </div>
      <SettingsPanel />
    </div>
  );
}
