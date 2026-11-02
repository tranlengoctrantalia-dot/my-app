/** Có lỗi khi vẽ màn hình → hiện thông báo + nút sửa, thay vì để màn trắng. */
import { Component, type ReactNode } from 'react';
import { L } from '../labels';

declare global {
  interface Window {
    __vgFix?: () => void;
  }
}

export class CrashGuard extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const C = L.crash;
    return (
      <div className="crash">
        <img src="/icon.svg" alt="" width={56} height={56} />
        <b>{C.title}</b>
        <span className="muted">{C.text}</span>
        <button className="btn btn--primary" onClick={() => location.reload()}>
          {C.reload}
        </button>
        <button className="btn" onClick={() => (window.__vgFix ? window.__vgFix() : location.reload())}>
          {C.fix}
        </button>
        <small className="crash__err">{String(error.message || error)}</small>
      </div>
    );
  }
}
