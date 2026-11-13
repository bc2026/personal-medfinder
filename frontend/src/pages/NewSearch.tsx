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
          "Live pharmacy lookup was unavailable — showing sample pharmacies without phone numbers. Add real pharmacies manually or try again later."
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
    <div className="page-enter max-w-xl">
      <h1 className="page-title">New medication search</h1>
      <p className="page-lead mb-8">
        Find nearby pharmacies, then confirm stock by phone or AI-assisted call.
      </p>

      <DisclaimerBanner />

      <form onSubmit={handleSubmit} className="card p-6 sm:p-8 space-y-5 page-enter stagger-2">
        <label className="block text-sm">
          <span className="font-semibold text-[var(--color-ink)]">
            Medication name <span className="text-[var(--color-accent)]">*</span>
          </span>
          <input
            required
            value={form.medicationName}
            onChange={(e) =>
              setForm({ ...form, medicationName: e.target.value })
            }
            className="input font-display text-lg"
            placeholder="e.g. Lisinopril"
          />
        </label>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="font-semibold">Strength</span>
            <input
              value={form.strength}
              onChange={(e) => setForm({ ...form, strength: e.target.value })}
              className="input"
              placeholder="10mg"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold">Quantity</span>
            <input
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="input"
              placeholder="30 tablets"
            />
          </label>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="font-semibold">
              ZIP code <span className="text-[var(--color-accent)]">*</span>
            </span>
            <input
              required
              pattern="\d{5}"
              maxLength={5}
              value={form.zipCode}
              onChange={(e) => setForm({ ...form, zipCode: e.target.value })}
              className="input tabular-nums"
              placeholder="08901"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold">Radius (miles)</span>
            <input
              type="number"
              min={1}
              max={50}
              value={form.radius}
              onChange={(e) =>
                setForm({ ...form, radius: Number(e.target.value) })
              }
              className="input"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="font-semibold">Notes</span>
          <textarea
            value={form.userNotes}
            onChange={(e) => setForm({ ...form, userNotes: e.target.value })}
            rows={2}
            className="input resize-y min-h-[4.5rem]"
            placeholder="Insurance, preferred chain, urgency…"
          />
        </label>

        {error && (
          <p className="text-sm text-[var(--color-danger)] font-medium">{error}</p>
        )}

        <button type="submit" disabled={loading} className="btn-primary min-h-11 w-full py-3">
          {loading ? "Finding pharmacies…" : "Find nearby pharmacies"}
        </button>
      </form>
    </div>
  );
}
