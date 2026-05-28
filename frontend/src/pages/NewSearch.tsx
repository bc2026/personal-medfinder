import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { DisclaimerBanner } from "../components/DisclaimerBanner";

export function NewSearch() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    medicationName: "",
    strength: "",
    quantity: "",
    zipCode: "",
    radius: 10,
    userNotes: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { session, usedFallback } = await api.createSession({
        medicationName: form.medicationName.trim(),
        strength: form.strength.trim() || undefined,
        quantity: form.quantity.trim() || undefined,
        zipCode: form.zipCode.trim(),
        radius: form.radius,
        userNotes: form.userNotes.trim() || undefined,
      });
      if (usedFallback) {
        sessionStorage.setItem(
          "medfinder-toast",
          "Live pharmacy lookup was unavailable — showing sample/demo pharmacies. You can still log real call results."
        );
      }
      navigate(`/sessions/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">New medication search</h1>
      <p className="text-[var(--color-muted)] mb-6">
        Find nearby pharmacies, then confirm stock by phone.
      </p>

      <DisclaimerBanner />

      <form
        onSubmit={handleSubmit}
        className="max-w-lg space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-6"
      >
        <label className="block text-sm">
          <span className="font-medium">Medication name *</span>
          <input
            required
            value={form.medicationName}
            onChange={(e) =>
              setForm({ ...form, medicationName: e.target.value })
            }
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
            placeholder="e.g. Lisinopril"
          />
        </label>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="font-medium">Strength</span>
            <input
              value={form.strength}
              onChange={(e) => setForm({ ...form, strength: e.target.value })}
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
              placeholder="10mg"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Quantity</span>
            <input
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
              placeholder="30 tablets"
            />
          </label>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="font-medium">ZIP code *</span>
            <input
              required
              pattern="\d{5}"
              maxLength={5}
              value={form.zipCode}
              onChange={(e) => setForm({ ...form, zipCode: e.target.value })}
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
              placeholder="08901"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Radius (miles)</span>
            <input
              type="number"
              min={1}
              max={50}
              value={form.radius}
              onChange={(e) =>
                setForm({ ...form, radius: Number(e.target.value) })
              }
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="font-medium">Notes</span>
          <textarea
            value={form.userNotes}
            onChange={(e) => setForm({ ...form, userNotes: e.target.value })}
            rows={2}
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
            placeholder="Insurance, preferred chain, urgency…"
          />
        </label>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          {loading ? "Finding pharmacies…" : "Find nearby pharmacies"}
        </button>
      </form>
    </div>
  );
}
