import { Card } from '../components/ui';
import { useDriveSync } from './DriveSync';
import { Icon } from '../components/icons';
import { L } from '../labels';

const statusText = {
  off: L.drive.status.off,
  syncing: L.drive.status.syncing,
  ok: L.drive.status.ok,
  'need-login': L.drive.status.needLogin,
  error: L.drive.status.error,
} as const;

export function DriveCard() {
  const { enabled, session, status, message, connect, reconnect, syncNow, disconnect } = useDriveSync();

  return (
    <Card title={L.drive.title}>
      {!enabled ? (
        <p className="hint">{L.drive.notConfigured}</p>
      ) : !session ? (
        <>
          <p className="hint">{L.drive.intro}</p>
          <div className="form__actions form__actions--start">
            <button className="btn btn--primary" onClick={connect}>
              {L.drive.login}
            </button>
          </div>
        </>
      ) : (
        <>
          <dl className="ledger">
            <div>
              <dt>{L.drive.account}</dt>
              <dd>{session.email}</dd>
            </div>
            <div>
              <dt>{L.drive.statusLabel}</dt>
              <dd className={status === 'ok' ? 'pos' : status === 'error' || status === 'need-login' ? 'neg' : ''}>{statusText[status]}</dd>
            </div>
            <div>
              <dt>{L.drive.lastSync}</dt>
              <dd>{session.lastSync ? new Date(session.lastSync).toLocaleString('vi-VN') : '—'}</dd>
            </div>
          </dl>
          {message && <p className="hint neg">{message}</p>}
          <div className="form__actions form__actions--start">
            {status === 'need-login' ? (
              <button className="btn btn--primary" onClick={reconnect}>
                {L.drive.relogin}
              </button>
            ) : (
              <button className="btn" onClick={syncNow} disabled={status === 'syncing'}>
                {L.drive.syncNow}
              </button>
            )}
            <button className="btn btn--danger-ghost" onClick={() => confirm(L.drive.logoutConfirm) && disconnect()}>
              {L.drive.logout}
            </button>
          </div>
        </>
      )}
    </Card>
  );
}

/** Nhắc ở trang Tổng quan khi sao lưu bị ngắt. */
export function DriveBanner({ onOpen }: { onOpen: () => void }) {
  const { session, status, reconnect } = useDriveSync();
  if (!session || (status !== 'need-login' && status !== 'error')) return null;
  return (
    // Hết phiên: chạm là đăng nhập lại luôn. Lỗi khác: mở Cài đặt để xem chi tiết.
    <button className="banner" onClick={status === 'need-login' ? reconnect : onOpen}>
      <Icon name="cloud" size={18} />
      {status === 'need-login' ? L.drive.bannerNeedLogin : L.drive.bannerError}
    </button>
  );
}
