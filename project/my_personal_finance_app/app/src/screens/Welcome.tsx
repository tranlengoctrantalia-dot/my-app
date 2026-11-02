import { useState } from 'react';
import { RippleAvatar } from '../components/Avatar';
import { LookPicker } from '../components/LookPicker';
import { Card, MoneyInput, NumberInput } from '../components/ui';
import { useStore } from '../store';
import { useDriveSync } from '../sync/DriveSync';
import { setAvatar } from '../theme';
import { L } from '../labels';

/** Lần đầu mở app: chọn giao diện, rồi vài con số cơ bản — hoặc khôi phục từ Drive. */
export function Welcome() {
  const { data, dispatch } = useStore();
  const drive = useDriveSync();
  const [step, setStep] = useState<'hello' | 'setup'>('hello');
  // Người mới: hình đại diện mặc định là hình trung tính (chưa chọn gì).
  useState(() => {
    try {
      if (!localStorage.getItem('vi-cua-nang/avatar')) setAvatar('person');
    } catch {
      /* bỏ qua */
    }
  });
  const [hasCard, setHasCard] = useState(false);
  const [cardName, setCardName] = useState(L.welcome.defaultCardName);
  const [cutoffDay, setCutoff] = useState(data.settings.cutoffDay);
  const [dueDay, setDue] = useState(data.settings.dueDay);
  const [salaryDay, setSalary] = useState(data.settings.salaryDay);
  const [cash, setCash] = useState(0);

  function finish() {
    const accounts = data.accounts
      .filter((a) => hasCard || a.kind !== 'credit')
      .map((a) => (a.kind === 'credit' ? { ...a, name: cardName.trim() || a.name } : a));
    // Không dùng thẻ: tính theo tháng dương lịch (1 → cuối tháng).
    dispatch({ type: 'finishSetup', accounts, patch: { cutoffDay: hasCard ? cutoffDay : 31, dueDay, salaryDay, cashOnHand: cash } });
  }

  return (
    <div className="welcome">
      {step === 'hello' ? (
        <>
          <div className="welcome__hero">
            <RippleAvatar size={120} />
            <h1>{L.welcome.hello}</h1>
            <p className="muted">{L.welcome.intro}</p>
          </div>
          <Card>
            <LookPicker />
          </Card>
          <button className="btn btn--primary btn--block" onClick={() => setStep('setup')}>
            {L.welcome.start}
          </button>
          {drive.enabled && (
            <button className="btn btn--block" onClick={drive.connect} disabled={drive.status === 'syncing'}>
              {drive.status === 'syncing' ? L.common.loading : L.welcome.restore}
            </button>
          )}
          {drive.message && <p className="hint neg">{drive.message}</p>}
        </>
      ) : (
        <>
          <h1 className="welcome__title">{L.welcome.setupTitle}</h1>
          <Card>
            <div className="form">
              <label className="switch-row">
                <span>{L.welcome.hasCard}</span>
                <input type="checkbox" checked={hasCard} onChange={(e) => setHasCard(e.target.checked)} />
              </label>
              {hasCard && (
                <>
                  <label className="field">
                    <span>{L.welcome.cardName}</span>
                    <input value={cardName} onChange={(e) => setCardName(e.target.value)} />
                  </label>
                  <div className="field-row">
                    <label className="field">
                      <span>{L.welcome.cutoffDay}</span>
                      <NumberInput min={1} max={31} value={cutoffDay} onChange={setCutoff} />
                    </label>
                    <label className="field">
                      <span>{L.welcome.dueDay}</span>
                      <NumberInput min={1} max={31} value={dueDay} onChange={setDue} />
                    </label>
                  </div>
                </>
              )}
              <label className="field">
                <span>{L.welcome.salaryDay}</span>
                <NumberInput min={1} max={31} value={salaryDay} onChange={setSalary} />
              </label>
              <label className="field">
                <span>{L.welcome.cash}</span>
                <MoneyInput value={cash} onChange={setCash} />
              </label>
            </div>
          </Card>
          <button className="btn btn--primary btn--block" onClick={finish}>
            {L.common.done}
          </button>
          <button className="link link--center" onClick={() => setStep('hello')}>
            {L.common.back}
          </button>
        </>
      )}
    </div>
  );
}
