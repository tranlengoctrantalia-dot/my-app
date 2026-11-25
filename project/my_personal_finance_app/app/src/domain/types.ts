/** Ngày dạng 'YYYY-MM-DD'. */
export type ISODate = string;
/** Kỳ dạng 'YYYY-MM' — tháng đến hạn trả thẻ (vd. '2026-11' = kỳ trả 25/11). */
export type PeriodKey = string;

export type AccountKind = 'credit' | 'ewallet' | 'bank' | 'cash';

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  /**
   * Bật theo dõi số dư: số dư = balanceAdjust + tiền vào/ra của nguồn này.
   * Khi người dùng nhập "số dư hiện tại", app tính lại balanceAdjust cho khớp. Thẻ tín dụng: số âm = đang nợ.
   */
  balanceAdjust?: number;
  /**
   * Mốc số dư: ngày nhập + số dư thật lúc đó + id các khoản cùng ngày đã có lúc nhập.
   * Có mốc thì số dư = số lúc nhập + các khoản SAU mốc; khoản ghi lùi ngày (nhập sao kê, ghi bù) không trừ lần nữa.
   */
  balanceAt?: {
    date: ISODate;
    amount: number;
    seen: string[];
    /** Phần đã trả lại CHƯA có ngày nhận (`TxSplit.log`) của từng khoản, lúc nhập số dư. */
    paid?: Record<string, number>;
    v?: number;
    /** Giờ nhập số dư (ms): tiền trả lại ghi cùng ngày thì so giờ để biết trước hay sau mốc. */
    ts?: number;
  };
  /** Thẻ tín dụng: ngày chốt sao kê / ngày hạn trả riêng của thẻ này (bỏ trống = dùng ngày chung trong Cài đặt). */
  cutoffDay?: number;
  dueDay?: number;
}

/**
 * spend: chi tiêu linh hoạt; fixed: khoản cố định phải chi bằng tiền mặt/chuyển khoản
 * (gửi mẹ, gym, góp quỹ, tiết kiệm); installment: trả góp, tự tính từ danh sách trả góp;
 * income: khoản thu (lương, thưởng…).
 */
export type CategoryKind = 'spend' | 'fixed' | 'installment' | 'income';

export interface Category {
  id: string;
  name: string;
  icon: string;
  kind: CategoryKind;
  /** Tên icon Material Symbols và màu do người dùng chọn (danh mục tự tạo). */
  iconName?: string;
  color?: string;
}

/** Ai chịu phần còn lại của giao dịch ngoài phần của mình. */
/** Id của người chia tiền cùng (trong Cài đặt → Cách chia tiền → Người hay chia tiền cùng). */
export type Counterparty = string;

/** Phần của một người trong khoản chia tiền: phải trả bao nhiêu, đã trả lại bao nhiêu. */
export interface TxSplit {
  person: Counterparty;
  amount: number;
  paid: number;
  /** Từng lần trả (hoặc sửa bớt): ngày nhận + số tiền chênh. Bản cũ không có; phần `paid` ngoài log là chưa rõ ngày. */
  log?: PaidEntry[];
}

/** Một lần người khác trả lại tiền. `ts` = giờ ghi (ms), để so với mốc số dư cùng ngày. */
export interface PaidEntry {
  date: ISODate;
  amount: number;
  /** Phần trả dư (vượt số nợ) trong lần này: không tính vào nợ, vẫn cộng vào ví. */
  extra?: number;
  ts: number;
}

/** Người hay chia tiền cùng: người yêu, bạn bè, gia đình, công ty… */
export interface Person {
  id: string;
  name: string;
}

/** Cách chia tiền: mình chịu `mine` phần, bên kia chịu `other` phần (vd. hẹn hò 1:2). */
export interface SplitPreset {
  id: string;
  name: string;
  mine: number;
  other: number;
  counterparty?: Counterparty;
}

export interface Transaction {
  id: string;
  /** Đơn đã huỷ: vẫn hiện trong Sổ chi (gạch ngang) nhưng không tính vào đâu cả. */
  cancelled?: boolean;
  date: ISODate;
  merchant: string;
  /** Tổng tiền giao dịch; âm nếu là hoàn tiền. */
  amount: number;
  categoryId: string;
  accountId: string;
  /** Phần mình chịu. Bằng amount nếu tự trả hết. */
  myShare: number;
  counterparty?: Counterparty;
  /**
   * Chia với nhiều người: phần từng người + đã trả. Có splits thì bỏ qua counterparty / reimbursed
   * (hai trường đó là cách lưu cũ, chỉ chia được với 1 người).
   */
  splits?: TxSplit[];
  /** Số tiền bên kia đã hoàn lại cho mình. */
  reimbursed: number;
  note?: string;
  /** Đóng trước cho nhiều tháng (vd. quỹ T10 + T11): ví / thẻ trừ đủ ngày ghi, ngân sách chia đều cho từng tháng. */
  spreadMonths?: number;
  /**
   * Đã chuyển thành trả góp (id khoản trả góp): không tính chi tiêu / sao kê / số dư nữa (trả góp tính thay),
   * chỉ giữ lại để theo dõi phần người khác còn nợ.
   */
  installmentId?: string;
  /**
   * 'income' = khoản thu; 'transfer' = chuyển tiền giữa hai nguồn của mình (từ accountId sang toAccountId,
   * không tính là chi hay thu); 'lend' = cho người khác vay (tiền ra, splits[0] = người vay + đã trả lại);
   * 'borrow' = mình đi vay (tiền vào, splits[0] = người cho vay + mình đã trả lại);
   * bỏ trống = khoản chi (hoặc hoàn tiền nếu amount âm).
   */
  kind?: 'income' | 'transfer' | 'lend' | 'borrow';
  /** Nguồn nhận tiền khi kind = 'transfer'. */
  toAccountId?: string;
  /** Nguồn nhập tự động, vd. 'gmail:<message id>' — để không nhập trùng. */
  source?: string;
}

export interface Installment {
  id: string;
  name: string;
  accountId: string;
  categoryId: string;
  monthly: number;
  /** Kỳ đầu tiên phải trả. */
  firstPeriod: PeriodKey;
  /** Số kỳ; null nếu chưa rõ (coi như đang chạy). */
  months: number | null;
  /** Số tiền gốc mua trả góp. */
  principal?: number;
  /** Lãi suất %/năm (0 = trả góp 0%). */
  ratePerYear?: number;
  /** Phí chuyển đổi trả góp, tính một lần vào kỳ đầu. */
  fee?: number;
  /** Phần mình chịu (0–1) khi khoản mua có chia tiền: sao kê tính đủ, ngân sách chỉ tính phần này. Bỏ trống = 1. */
  share?: number;
}

export interface BudgetLine {
  categoryId: string;
  limit: number;
}

export interface Budget {
  period: PeriodKey;
  income: number;
  lines: BudgetLine[];
}

export interface Settings {
  /** Giao dịch có ngày <= cutoffDay thuộc kỳ trả tháng này; sau đó sang kỳ tháng sau. */
  cutoffDay: number;
  /** Kỳ thẻ người dùng đánh dấu "đã trả hết ở ngân hàng" ('<id thẻ>:<kỳ>'): coi như đã trả đủ. */
  cardSettled?: string[];
  dueDay: number;
  salaryDay: number;
  partnerName: string;
  /** Tiền đang có trong tài khoản, dùng để kiểm tra đủ trả thẻ. */
  cashOnHand: number;
  /** Quỹ tiết kiệm riêng — bản cũ, không còn dùng (tiết kiệm / tiền đệm nằm ở Mục tiêu). */
  savingsFund: number;
  /** Bộ lọc Gmail để tìm email thông báo giao dịch. */
  gmailQuery?: string;
  /** Giới hạn khi quét Gmail: khoảng thời gian, số email, ngân hàng. */
  gmailLimits?: { range: 'since' | 7 | 30 | 90; max: number; banks?: string[] };
  /** Ngày đọc Gmail gần nhất (YYYY-MM-DD), cho lựa chọn "từ lần trước". */
  gmailLastRead?: string;
  /** Cách chia tiền do người dùng tự thêm. */
  splitPresets?: SplitPreset[];
  /** Những người hay chia tiền cùng. */
  people?: Person[];
  /** Đã chuyển các cách chia cố định của bản cũ thành danh sách sửa được. */
  splitV2?: boolean;
  /** Che thông tin cá nhân trước khi gửi AI (mặc định bật). */
  aiRedact?: boolean;
  /** Họ tên / từ riêng cần che, cách nhau bằng dấu phẩy. */
  privacyWords?: string;
  reminders?: Reminders;
  /** Ngày người khác hẹn trả lại tiền cho mình (id người → ngày). */
  promises?: Record<string, ISODate>;
}

/** Khoản lặp lại hàng tháng (tiền nhà, Netflix, lương…): app tự ghi khi tới ngày. */
export interface Recurring {
  id: string;
  merchant: string;
  amount: number;
  categoryId: string;
  accountId: string;
  /** Ngày trong tháng (1–31; tháng ngắn hơn thì lấy ngày cuối tháng). */
  day: number;
  kind?: 'income';
  /** Cách chia (id trong Cài đặt → Cách chia tiền); bỏ trống = mình trả. */
  splitId?: string;
  /** Chia với ai (id người). */
  counterparty?: Counterparty;
  /** Chia với nhiều người (id người). */
  people?: Counterparty[];
  /** Bắt đầu từ ngày này. */
  startDate: ISODate;
  /** Lần gần nhất đã tự ghi. */
  lastDate?: ISODate;
  /** Tạm dừng thì không tự ghi nữa. */
  paused?: boolean;
}

/** Mục tiêu tiết kiệm: du lịch, mua điện thoại… */
export interface Goal {
  id: string;
  name: string;
  icon?: string;
  target: number;
  /** Hạn muốn đạt (để tính mỗi tháng cần để dành bao nhiêu). */
  deadline?: ISODate;
  /** Các lần bỏ tiền vào (số âm = rút ra). `opening` = tiền có từ trước: không tính vào tháng nào. */
  deposits: { date: ISODate; amount: number; opening?: boolean }[];
}

/** Nhắc nhở / thông báo (lưu theo dữ liệu, đồng bộ cùng sao lưu). */
export interface Reminders {
  /** Nhắc ghi chi tiêu mỗi tối (giờ 0–23); bỏ trống = tắt. */
  dailyHour?: number;
  /** Nhắc trước hạn trả thẻ bao nhiêu ngày; bỏ trống = tắt. */
  cardDays?: number;
  /** Báo khi danh mục / tổng ngân sách chạm ngưỡng %; bỏ trống = tắt. */
  budgetPct?: number;
}

export interface AppData {
  version: 1;
  /** Thời điểm sửa gần nhất (ms), dùng khi đồng bộ Google Drive. */
  updatedAt?: number;
  /** Người mới mở app lần đầu, chưa qua bước cài đặt ban đầu. */
  setupPending?: boolean;
  settings: Settings;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  installments: Installment[];
  budgets: Budget[];
  recurring?: Recurring[];
  goals?: Goal[];
}
