import { useEffect, useState } from "react";
import { socket } from "../lib/socket";
import type { OpenClawConfig } from "@safeclaw/shared";

const RECOMMENDED_MODELS = [
  "anthropic/claude-4.5-sonnet",
  "anthropic/claude-4-opus",
  "openai/gpt-5",
  "openai/gpt-4.5",
];

const WEAK_MODELS = [
  "anthropic/claude-haiku-4-5",
  "anthropic/claude-haiku-3-5",
];

export function OpenClawPage() {
  const [config, setConfig] = useState<OpenClawConfig | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [trustedProxies, setTrustedProxies] = useState("");
  const [primaryModel, setPrimaryModel] = useState("");
  const [dmPolicy, setDmPolicy] = useState("");
  const [allowFrom, setAllowFrom] = useState("");
  const [maxConcurrent, setMaxConcurrent] = useState("");
  const [subagentMaxConcurrent, setSubagentMaxConcurrent] = useState("");

  useEffect(() => {
    socket.emit("safeclaw:getOpenclawConfig");

    const handler = (data: OpenClawConfig | null) => {
      if (!data) {
        setNotFound(true);
        return;
      }
      setConfig(data);
      setTrustedProxies(data.gateway?.trustedProxies?.join(", ") ?? "");
      setPrimaryModel(data.agents?.defaults?.model?.primary ?? "");
      setDmPolicy(data.channels?.whatsapp?.dmPolicy ?? "");
      setAllowFrom(data.channels?.whatsapp?.allowFrom?.join(", ") ?? "");
      setMaxConcurrent(String(data.agents?.defaults?.maxConcurrent ?? ""));
      setSubagentMaxConcurrent(
        String(data.agents?.defaults?.subagents?.maxConcurrent ?? ""),
      );
    };

    socket.on("safeclaw:openclawConfig", handler);
    return () => {
      socket.off("safeclaw:openclawConfig", handler);
    };
  }, []);

  const handleSave = (updates: Partial<OpenClawConfig>) => {
    setSaving(true);
    socket.emit("safeclaw:updateOpenclawConfig", updates);
    setTimeout(() => setSaving(false), 600);
  };

  const saveGateway = () => {
    const proxies = trustedProxies
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    handleSave({
      gateway: {
        trustedProxies: proxies.length > 0 ? proxies : undefined,
      },
    });
  };

  const saveModel = () => {
    handleSave({
      agents: {
        defaults: {
          model: { primary: primaryModel },
        },
      },
    });
  };

  const saveConcurrency = () => {
    handleSave({
      agents: {
        defaults: {
          maxConcurrent: maxConcurrent ? Number(maxConcurrent) : undefined,
          subagents: subagentMaxConcurrent
            ? { maxConcurrent: Number(subagentMaxConcurrent) }
            : undefined,
        },
      },
    });
  };

  const saveChannel = () => {
    const numbers = allowFrom
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    handleSave({
      channels: {
        whatsapp: {
          dmPolicy,
          allowFrom: numbers.length > 0 ? numbers : undefined,
        },
      },
    });
  };

  if (notFound) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6">OpenClaw Configuration</h2>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <p className="text-gray-400">
            OpenClaw config not found at <code>~/.openclaw/openclaw.json</code>.
          </p>
          <p className="text-gray-500 mt-2 text-sm">
            Install and configure OpenClaw first, then return here to manage its
            settings through SafeClaw.
          </p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6">OpenClaw Configuration</h2>
        <p className="text-gray-500">Loading OpenClaw configuration...</p>
      </div>
    );
  }

  const isWeakModel = WEAK_MODELS.includes(primaryModel);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">OpenClaw Configuration</h2>
      <p className="text-sm text-gray-500 mb-6">
        Manage the settings of your OpenClaw instance directly from SafeClaw.
        Changes are written to <code>~/.openclaw/openclaw.json</code>.
      </p>

      <div className="space-y-4">
        {/* Security: Model Selection */}
        <Section title="Agent Model" badge={isWeakModel ? "WARN" : undefined}>
          <p className="text-sm text-gray-500 mb-3">
            The primary model used by OpenClaw agents. Weaker models are more
            susceptible to prompt injection.
          </p>
          {isWeakModel && (
            <div className="rounded-lg bg-yellow-900/30 border border-yellow-700/50 px-4 py-2 mb-3">
              <p className="text-sm text-yellow-400">
                Current model is below recommended tier. Consider upgrading to a
                top-tier model.
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <select
              value={primaryModel}
              onChange={(e) => setPrimaryModel(e.target.value)}
              className="flex-1 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-primary"
            >
              <optgroup label="Recommended">
                {RECOMMENDED_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Not Recommended">
                {WEAK_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m} (weak)
                  </option>
                ))}
              </optgroup>
              {!RECOMMENDED_MODELS.includes(primaryModel) &&
                !WEAK_MODELS.includes(primaryModel) && (
                  <option value={primaryModel}>{primaryModel}</option>
                )}
            </select>
            <SaveButton onClick={saveModel} saving={saving} />
          </div>
        </Section>

        {/* Security: Gateway Trusted Proxies */}
        <Section
          title="Gateway Trusted Proxies"
          badge={
            !config.gateway?.trustedProxies?.length ? "WARN" : undefined
          }
        >
          <p className="text-sm text-gray-500 mb-3">
            If you expose the Control UI through a reverse proxy, configure
            trusted proxies so local-client checks cannot be spoofed. Comma
            separated IPs.
          </p>
          {!config.gateway?.trustedProxies?.length && (
            <div className="rounded-lg bg-yellow-900/30 border border-yellow-700/50 px-4 py-2 mb-3">
              <p className="text-sm text-yellow-400">
                No trusted proxies configured. Set your proxy IPs or keep the
                Control UI local-only.
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={trustedProxies}
              onChange={(e) => setTrustedProxies(e.target.value)}
              placeholder="e.g. 10.0.0.1, 192.168.1.1"
              className="flex-1 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
            <SaveButton onClick={saveGateway} saving={saving} />
          </div>
        </Section>

        {/* Agent Concurrency */}
        <Section title="Agent Concurrency">
          <p className="text-sm text-gray-500 mb-3">
            Limit the number of concurrent agents and subagents running.
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-400 w-40">Max agents</label>
              <input
                type="number"
                value={maxConcurrent}
                onChange={(e) => setMaxConcurrent(e.target.value)}
                min={1}
                max={32}
                className="w-24 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-400 w-40">
                Max subagents
              </label>
              <input
                type="number"
                value={subagentMaxConcurrent}
                onChange={(e) => setSubagentMaxConcurrent(e.target.value)}
                min={1}
                max={64}
                className="w-24 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div className="flex justify-end mt-2">
              <SaveButton onClick={saveConcurrency} saving={saving} />
            </div>
          </div>
        </Section>

        {/* Channel: WhatsApp */}
        <Section title="WhatsApp Channel">
          <p className="text-sm text-gray-500 mb-3">
            Control who can message the OpenClaw agent via WhatsApp.
          </p>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-400 w-40">DM Policy</label>
              <select
                value={dmPolicy}
                onChange={(e) => setDmPolicy(e.target.value)}
                className="flex-1 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-primary"
              >
                <option value="allowlist">Allowlist only</option>
                <option value="open">Open (anyone can message)</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">
                Allowed phone numbers (comma separated)
              </label>
              <input
                type="text"
                value={allowFrom}
                onChange={(e) => setAllowFrom(e.target.value)}
                placeholder="e.g. +491234567890, +1555123456"
                className="w-full rounded-lg bg-gray-800 border border-gray-700 text-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div className="flex justify-end">
              <SaveButton onClick={saveChannel} saving={saving} />
            </div>
          </div>
        </Section>

        {/* Gateway Info (read-only) */}
        <Section title="Gateway">
          <div className="space-y-2">
            <InfoRow label="Mode" value={config.gateway?.mode ?? "—"} />
            <InfoRow
              label="Port"
              value={String(config.gateway?.port ?? "—")}
            />
            <InfoRow label="Bind" value={config.gateway?.bind ?? "—"} />
            <InfoRow
              label="Auth mode"
              value={config.gateway?.auth?.mode ?? "—"}
            />
            <InfoRow
              label="Tailscale"
              value={config.gateway?.tailscale?.mode ?? "off"}
            />
          </div>
        </Section>

        {/* Plugins (read-only) */}
        <Section title="Plugins">
          <div className="space-y-2">
            {config.plugins?.entries &&
            Object.keys(config.plugins.entries).length > 0 ? (
              Object.entries(config.plugins.entries).map(([name, entry]) => (
                <InfoRow
                  key={name}
                  label={name}
                  value={entry.enabled ? "Enabled" : "Disabled"}
                />
              ))
            ) : (
              <p className="text-sm text-gray-500">No plugins configured.</p>
            )}
          </div>
        </Section>

        {/* Meta (read-only) */}
        <Section title="Instance Info">
          <div className="space-y-2">
            <InfoRow
              label="Last version"
              value={config.meta?.lastTouchedVersion ?? "—"}
            />
            <InfoRow
              label="Last updated"
              value={config.meta?.lastTouchedAt ?? "—"}
            />
            <InfoRow
              label="Workspace"
              value={config.agents?.defaults?.workspace ?? "—"}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-medium text-gray-200">{title}</h3>
        {badge && (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-900/50 text-yellow-400 border border-yellow-700/50">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function SaveButton({
  onClick,
  saving,
}: {
  onClick: () => void;
  saving: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
    >
      {saving ? "Saving..." : "Save"}
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm text-gray-200">{value}</span>
    </div>
  );
}
