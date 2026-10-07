import { useEffect, useRef, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, Cloud, Download, HeartHandshake, LogOut, Trash } from "../components/Icons";
import { Button, Sheet } from "../components/ui";
import { partnerSettingsValue } from "../domain/partner";
import { accountLine, initialsFor, profileHeading } from "../lib/auth";
import { downloadSnapshot } from "../lib/exportData";
import { useApp } from "../state/AppState";
import { useAuth } from "../state/auth-context";
import { usePartner } from "../state/partner-context";

export function Account({ onBack, onOpenPartner }: { onBack: () => void; onOpenPartner?: () => void }) {
  const auth = useAuth();
  const readingPartner = usePartner();
  const { snapshot, showToast, today } = useApp();
  const user = auth.user;
  const savedName = user?.displayName ?? "";
  const [name, setName] = useState(savedName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const dirty = useRef(false);

  useEffect(() => {
    if (!dirty.current) setName(savedName);
  }, [savedName]);

  if (!user) return null;

  const heading = profileHeading(name, user.email);

  async function saveName() {
    const next = name.trim().slice(0, 80);
    if (next === savedName.trim()) return;
    const error = await auth.saveDisplayName(next);
    if (error) {
      setNameError(error);
      return;
    }
    dirty.current = false;
    setNameError(null);
  }

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    const error = await auth.signOut();
    setSigningOut(false);
    if (error) {
      setActionError(error);
      return;
    }
    showToast("Signed out. This device still has your reading.");
    onBack();
  }

  async function removeAccount() {
    if (deleting) return;
    setDeleting(true);
    const error = await auth.deleteAccount();
    setDeleting(false);
    if (error) {
      setActionError(error);
      setConfirmDelete(false);
      return;
    }
    showToast("Account deleted. This device still has your reading.");
    onBack();
  }

  return (
    <section className="screen screen-tabbed screen-gap-22 account">
      <div className="account-nav">
        <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
          <ChevronLeft size={18} />
        </button>
        <h1>Account</h1>
        <span className="account-nav-end" aria-hidden="true" />
      </div>
      <div className="account-profile">
        <div className="avatar-wrap">
          <div className="avatar" aria-hidden="true">
            {initialsFor(name, user.email)}
          </div>
          <button
            type="button"
            className="avatar-badge"
            aria-label="Profile photo"
            onClick={() => showToast("Profile photos are optional. They’ll arrive with sync.")}
          >
            <Camera size={14} aria-hidden="true" />
          </button>
        </div>
        <p className="account-name">{heading}</p>
        <p className="account-email">{accountLine(user.email, user.provider)}</p>
      </div>
      <div className="account-form">
        <label className="auth-field">
          <span>Display name</span>
          <span className="auth-box">
            <input
              value={name}
              maxLength={80}
              autoComplete="name"
              onChange={(event) => {
                dirty.current = true;
                setName(event.target.value);
              }}
              onBlur={() => void saveName()}
            />
          </span>
        </label>
        <p className="auth-help">Shown to your groups and partner. Photo is optional.</p>
        {nameError ? (
          <p className="auth-error" role="alert">
            {nameError}
          </p>
        ) : null}
      </div>
      <section className="settings-group">
        <p className="eyebrow">Together</p>
        <div className="settings-card">
          <button type="button" className="settings-row" onClick={onOpenPartner}>
            <HeartHandshake className="row-icon" size={18} aria-hidden="true" />
            <span className="row-label">Reading partner</span>
            <strong className="row-value">
              {partnerSettingsValue({
                partnerName: readingPartner.partner?.displayName ?? null,
                inviteOpen: Boolean(readingPartner.invite),
              })}
            </strong>
            <ChevronRight className="chev" size={16} aria-hidden="true" />
          </button>
        </div>
        <p className="soft">Unlink anytime. A partner never sees your answer or notes.</p>
      </section>
      <section className="settings-group">
        <p className="eyebrow">Data</p>
        <div className="settings-card">
          <button type="button" className="settings-row" onClick={() => setSyncOpen(true)}>
            <Cloud className="row-icon" size={18} aria-hidden="true" />
            <span className="row-label">Sync</span>
            <strong className="row-value">{auth.syncEnabled ? "On" : "Off"}</strong>
            <ChevronRight className="chev" size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="settings-row"
            onClick={() => {
              downloadSnapshot(snapshot, today);
              showToast("Exported your data.");
            }}
          >
            <Download className="row-icon" size={18} aria-hidden="true" />
            <span className="row-label">Export my data</span>
            <ChevronRight className="chev" size={16} aria-hidden="true" />
          </button>
        </div>
      </section>
      <section className="settings-group">
        <div className="settings-card">
          <button type="button" className="settings-row" onClick={() => void signOut()} disabled={signingOut}>
            <LogOut className="row-icon" size={18} aria-hidden="true" />
            <span className="row-label">{signingOut ? "Signing out…" : "Sign out"}</span>
          </button>
          <button type="button" className="settings-row is-danger" onClick={() => setConfirmDelete(true)}>
            <Trash className="row-icon" size={18} aria-hidden="true" />
            <span className="row-label">Delete account</span>
          </button>
        </div>
        {actionError ? (
          <p className="auth-error" role="alert">
            {actionError}
          </p>
        ) : null}
      </section>
      {syncOpen ? (
        <Sheet title="Sync" onClose={() => setSyncOpen(false)}>
          <p>On, this account keeps your reading, plan, and notes. Off, changes stay on this device.</p>
          <div className="settings-card">
            <div className="settings-row">
              <Cloud className="row-icon" size={18} aria-hidden="true" />
              <span className="row-label">Sync</span>
              <button
                type="button"
                className={auth.syncEnabled ? "switch is-on" : "switch"}
                role="switch"
                aria-checked={auth.syncEnabled}
                aria-label="Sync"
                onClick={() => auth.setSyncEnabled(!auth.syncEnabled)}
              >
                <span />
              </button>
            </div>
          </div>
        </Sheet>
      ) : null}
      {confirmDelete ? (
        <Sheet title="Delete account?" onClose={() => setConfirmDelete(false)}>
          <p>This deletes your sign-in, profile, and the reading stored with this account. A copy stays on this device.</p>
          <div className="footer">
            <Button className="btn-caution" onClick={() => void removeAccount()} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete account"}
            </Button>
            <Button variant="quiet" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              Cancel
            </Button>
          </div>
        </Sheet>
      ) : null}
    </section>
  );
}
