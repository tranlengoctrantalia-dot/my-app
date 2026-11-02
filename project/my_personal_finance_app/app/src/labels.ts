/**
 * ===================== CÂU CHỮ TRONG APP =====================
 * Sửa chữ ở file này rồi build lại app (npm run build) là xong.
 *
 * Cách sửa:
 *  - Chỉ sửa phần chữ nằm trong dấu nháy '...'. Không đổi tên bên trái dấu hai chấm.
 *  - Trong chữ có dấu nháy đơn ' thì viết là \'  (vd. 'Bấm \'Lưu\'').
 *  - {ten} là chỗ app tự điền (số tiền, ngày, tên…): giữ nguyên chữ trong ngoặc nhọn,
 *    nhưng đổi vị trí trong câu thì được. Vd. 'Trả thẻ {date}' → 'Hạn trả thẻ: {date}'.
 *  - **chữ** = in đậm.
 *  - Dòng bắt đầu bằng // hoặc /* là ghi chú cho biết chữ nằm ở đâu trên màn hình, app không hiện.
 * ==============================================================
 */
export const L = {
  /* ============ CHỮ DÙNG CHUNG ============ */
  /* Chữ dùng chung ở nhiều chỗ */
  common: {
    // Nút chung
    close: 'Đóng',
    done: 'Xong',
    back: 'Quay lại',
    loading: 'Đang tải…',
    // Đơn vị tiền, hiện sau ô nhập tiền
    currency: 'đ',
    // Nút chuyển kỳ (tháng) trước / sau
    prevPeriod: 'Kỳ trước',
    nextPeriod: 'Kỳ sau',
  },

  /* ============ THANH DƯỚI, THANH TRÊN, TÊN MÀN HÌNH ============ */
  /* Thanh điều hướng + thanh trên cùng */
  nav: {
    // Tên app cạnh logo (màn hình rộng)
    brand: 'Ví Gọn',
    // Tên đọc cho thanh điều hướng (trình đọc màn hình)
    navAria: 'Điều hướng chính',
    // Các ô ở thanh dưới
    tabs: {
      home: 'Tổng quan',
      tx: 'Sổ chi',
      budget: 'Ngân sách',
      card: 'Thẻ',
      split: 'Chia tiền',
    },
    // Nút + to ở giữa thanh dưới
    add: 'Thêm khoản chi',
    // Tiêu đề trên cùng của từng màn hình
    titles: {
      tx: 'Sổ chi',
      card: 'Thẻ',
      budget: 'Ngân sách',
      split: 'Chia tiền & vay nợ',
      settings: 'Cài đặt',
      shared: 'Sổ chung',
      report: 'Báo cáo',
    },
    // Các nút tròn góc trên
    account: 'Tài khoản',
    lightMode: 'Giao diện sáng',
    darkMode: 'Giao diện tối',
    shared: 'Sổ chung',
    settings: 'Cài đặt',
  },

  /* ============ MÀN CHÀO (lần đầu mở app) ============ */
  /* Màn chào (lần đầu mở app) */
  welcome: {
    // Bước 1: chào + chọn giao diện
    hello: 'Chào bạn!',
    intro: 'Ghi chi tiêu, theo dõi thẻ, chia tiền với bạn bè.',
    start: 'Bắt đầu',
    restore: 'Khôi phục từ Google Drive',
    // Bước 2: vài con số cơ bản
    setupTitle: 'Vài con số cơ bản',
    hasCard: 'Có dùng thẻ tín dụng',
    cardName: 'Tên thẻ',
    defaultCardName: 'Thẻ tín dụng',
    cutoffDay: 'Ngày chốt sao kê',
    dueDay: 'Hạn trả thẻ',
    salaryDay: 'Ngày nhận lương',
    cash: 'Tiền đang có',
  },

  /* ============ HƯỚNG DẪN NHANH CHỈ TỪNG NÚT (màn chính) ============ */
  /* Hướng dẫn nhanh từng bước (khoanh sáng từng nút) */
  tour: {
    // Các nút dưới thẻ giải thích
    skip: 'Bỏ qua',
    next: 'Tiếp',
    done: 'Xong',
    // Các bước trên màn hình Tổng quan
    home: {
      add: { title: 'Ghi khoản chi / thu', text: 'Mỗi lần tiêu tiền hay nhận lương thì bấm nút này. Trong đó có nút AI quét để đọc email ngân hàng, ảnh chụp, sao kê giúp bạn.' },
      hero: { title: 'Tiêu được bao nhiêu', text: 'Số tiền tháng này đã tiêu, hoặc còn được tiêu nếu bạn đặt ngân sách. Chạm vào để đặt ngân sách.' },
      pills: { title: 'Vuốt ngang để xem thêm', text: 'Tài sản, tiền thẻ phải trả, ai đang nợ bạn, chi tiêu tháng này. Chạm vào ô nào để xem chi tiết ô đó.' },
      tx: { title: 'Sổ chi', text: 'Mọi khoản đã ghi theo từng ngày. Chạm vào một khoản để sửa hoặc xoá.' },
      budget: { title: 'Ngân sách', text: 'Đặt số tiền định tiêu cho từng mục (ăn uống, mua sắm…) — app báo khi sắp lố.' },
      card: { title: 'Thẻ tín dụng', text: 'Kỳ này phải trả thẻ bao nhiêu, hạn ngày nào, các khoản trả góp.' },
      split: { title: 'Chia tiền', text: 'Ai đang nợ bạn từ những lần đi chung. Họ trả rồi thì đánh dấu ở đây.' },
      shared: { title: 'Sổ chung', text: 'Ghi chung với bạn bè, người yêu — app tự tính ai nợ ai.' },
      account: { title: 'Tài khoản', text: 'Đăng nhập / đăng xuất Google, sao lưu dữ liệu.' },
      settings: { title: 'Cài đặt', text: 'Đổi màu, thêm thẻ / ví, danh mục… và Hướng dẫn sử dụng chi tiết nếu cần.' },
    },
  },

  /* ============ TỔNG QUAN (màn chính) ============ */
  /* Tổng quan (màn hình chính) */
  home: {
    // Chọn ô hiện ở màn chính
    customize: 'Chọn ô hiện ở đây',
    customizeTitle: 'Màn chính hiện gì?',
    customizeHint: 'Tắt bớt những ô bạn ít xem cho gọn. Bật lại lúc nào cũng được.',
    blocks: {
      wealth: 'Tài sản',
      card: 'Trả thẻ',
      owed: 'Người khác nợ bạn',
      owe: 'Bạn đang nợ',
      goals: 'Mục tiêu tiết kiệm',
      calendar: 'Sắp tới (lịch tiền)',
      recap: 'Tổng kết tháng trước',
      trend: 'Tổng chi & báo cáo',
      recent: 'Giao dịch gần đây',
    },
    recapSub: 'Tháng trước tiêu vào đâu',
    // Dòng gợi ý cho người mới (in đậm phần giữa ** **)
    newTip: '**Mới dùng?** Xem hướng dẫn 1 phút',
    // Ô lớn trên cùng — khi đã đặt ngân sách
    heroLeft: 'Còn tiêu được',
    heroOver: 'Tiêu lố',
    // Ô lớn trên cùng — khi chưa đặt ngân sách
    heroSpent: 'Đã tiêu tháng này',
    heroHint: 'Chạm để đặt ngân sách →',
    // Dòng trả thẻ
    cardDue: 'Trả thẻ {date}',
    cardDaysLeft: 'còn {n} ngày',
    cardOverdue: 'quá hạn',
    cardSurplus: 'dư {amount}',
    cardShort: 'thiếu {amount}',
    // Dòng người khác đang nợ mình
    partnerOwes: '{name} nợ',
    companyOwes: 'Công ty nợ',
    owedCount: '{n} khoản',
    manyOwe: 'Mọi người nợ bạn',
    manyOweSub: '{n} người · {k} khoản',
    // Dòng đã chi / đã thu
    spent: 'Đã tiêu',
    spentCount: '{n} giao dịch',
    earned: 'Đã thu',
    earnedCount: '{n} khoản',
    earnedNone: 'chưa có',
    // Khung biểu đồ chi tiêu
    reportLink: 'Báo cáo →',
    breakdownTitle: 'Tháng này chi vào đâu',
    donutTotal: 'Tổng',
    // Lời chào trên thẻ lớn (theo giờ trong ngày)
    greetMorning: 'Chào buổi sáng ☀️',
    greetNoon: 'Trưa rồi, nghỉ ngơi chút nha',
    greetAfternoon: 'Chào buổi chiều',
    greetEvening: 'Chào buổi tối 🌙',
    // Các ô nhỏ vuốt ngang
    tileWealth: 'Tài sản',
    tileWealthEmpty: 'Nhập số dư',
    tileWealthHint: 'Biết mình đang có bao nhiêu',
    tileWealthSub: '{n} ví / tài khoản',
    tileTrend: 'Tổng chi tháng này',
    // Khung các khoản gần đây
    recentTitle: 'Gần đây',
    seeAll: 'Xem hết →',
  },

  /* ============ BẢNG THÊM / SỬA KHOẢN CHI, THU, HOÀN ============ */
  /* Bảng thêm / sửa khoản chi (nút + ở giữa, hoặc chạm vào một khoản trong Sổ chi) */
  txForm: {
    // Tiêu đề bảng
    titleEdit: 'Sửa',
    titleIncome: 'Khoản thu',
    titleRefund: 'Hoàn tiền',
    titleExpense: 'Khoản chi',

    // Ba nút trên cùng + nút AI
    kindExpense: 'Chi',
    kindIncome: 'Thu',
    kindRefund: 'Hoàn',
    aiScan: 'AI quét',
    refundHint: 'Tiền được trả lại (trả hàng, huỷ đơn, hoàn tiền thẻ). Trừ bớt vào chi tiêu của danh mục bạn chọn.',

    // Nút "Chuyển": chuyển tiền giữa các ví / tài khoản của mình
    kindTransfer: 'Chuyển',
    titleTransfer: 'Chuyển tiền',
    transferHint: 'Chuyển giữa các nguồn của bạn: trả nợ thẻ, nạp Momo, rút tiền mặt… Không tính là chi hay thu.',
    fromLabel: 'Từ',
    toLabel: 'Sang',
    notePlaceholderTransfer: 'Trả nợ thẻ, nạp Momo…',
    defaultNameTransfer: 'Chuyển tiền',
    // Ghi nhầm trả nợ thẻ thành khoản chi
    cardPayWarn: 'Trả nợ thẻ thì ghi bằng **Chuyển** (từ tài khoản sang thẻ). Ghi bằng Chi sẽ bị tính là tiêu thêm, vì các món mua bằng thẻ đã được tính rồi.',
    cardPaySwitch: 'Đổi sang Chuyển',
    cardPayName: 'Trả thẻ',
    sameAccount: 'Chọn hai nguồn khác nhau',

    // Công tắc lặp lại (chỉ khi thêm khoản mới)
    repeatLabel: 'Lặp lại hàng tháng',
    // Đóng trước nhiều tháng (vd. quỹ T10 + T11)
    spreadLabel: 'Đóng trước cho nhiều tháng',
    spreadExample: 'Vd. đóng quỹ cho cả T10 + T11',
    spreadN: '{n} tháng',
    spreadHint: 'Ngân sách mỗi tháng tính {amount}, trong {n} tháng. Ví / thẻ vẫn trừ đủ hôm nay.',
    repeatHint: 'Tự ghi vào ngày {day} mỗi tháng. Sửa hoặc tạm dừng ở Cài đặt → Khoản định kỳ.',

    // Ô số tiền
    amountPlaceholder: '0',
    amountAria: 'Số tiền',

    // Phần danh mục
    categoryLabel: 'Danh mục',
    categoryLabelRefund: 'Hoàn tiền cho mục',
    categoryAria: 'Danh mục',
    addCategory: 'Thêm',

    // Phần ghi chú (gợi ý trong ô trống)
    noteLabel: 'Ghi chú',
    notePlaceholderIncome: 'Lương T11, thưởng…',
    notePlaceholderRefund: 'Shopee trả hàng…',
    notePlaceholderExpense: 'Mua ở đâu? (Shopee, Grab…)',

    // Tên khoản tự đặt khi bỏ trống ghi chú và không có danh mục
    defaultNameIncome: 'Khoản thu',
    defaultNameRefund: 'Hoàn tiền',
    defaultNameExpense: 'Chi tiêu',

    // Ngày & nguồn tiền
    dateLabel: 'Ngày',
    dateAria: 'Ngày',
    accountLabelIncome: 'Nhận vào',
    accountLabelRefund: 'Hoàn về',
    accountLabelExpense: 'Trả bằng',
    accountAria: 'Nguồn tiền',
    addAccount: '+ Thêm thẻ / ví…',

    // Phần chia tiền
    splitLabel: 'Ai chịu khoản này?',
    splitAria: 'Ai chịu khoản này',
    addSplit: '+ Tỉ lệ riêng',
    splitCustom: 'Tự nhập',
    myPart: 'Phần mình',
    company: 'Công ty',
    // Dòng giải thích dưới các lựa chọn chia
    hintAllMine: 'Bạn trả hết, tính cả vào chi tiêu của bạn.',
    // Dòng "Với ai?" hiện khi chọn cách chia có người khác
    withWho: 'Với ai?',
    addPerson: '+ Người khác',
    personPlaceholder: 'Tên (vd. Lan, Mẹ, Công ty)',
    addPersonOk: 'Thêm',
    needPerson: 'Chọn người chia cùng',
    someone: 'người kia',
    // Gợi ý khi chia với nhiều người ({others} = "Lan trả lại 150.000đ, Minh trả lại 150.000đ")
    hintPerson: '{name} trả lại {amount}',
    hintMulti: 'Phần bạn {mine} tính vào chi tiêu · {others}.',
    hintAllTheirsMulti: 'Không tính vào chi tiêu của bạn · {others}.',
    customOver: 'Phần người khác nhiều hơn tổng tiền {amount}',
    // "Tự nhập": ô số tiền của từng người
    theirPart: 'Phần {name}',
    hintAllTheirs: '{other} trả lại bạn đủ {amount}, không tính vào chi tiêu của bạn.',
    hintShared: 'Phần bạn {mine} tính vào chi tiêu · {other} trả lại {theirs}.',

    // Nút dưới cùng
    save: 'Lưu',
    pickCategory: 'Chọn danh mục',
    enterAmount: 'Nhập số tiền',
    delete: 'Xóa',
    confirmDelete: 'Xóa khoản này?',

    // Hướng dẫn lần đầu mở bảng
    tour: {
      kind: { title: 'Chi, Thu, Hoàn hay Chuyển', text: 'Chi: tiêu tiền. Thu: nhận lương, thưởng. Hoàn: tiền được trả lại khi trả hàng, huỷ đơn. Chuyển: chuyển giữa các ví của bạn (trả nợ thẻ, nạp Momo).' },
      amount: { title: 'Số tiền', text: 'Gõ số tiền, app tự thêm dấu chấm.' },
      category: { title: 'Danh mục', text: 'Chọn khoản này thuộc mục nào. Thiếu thì bấm Thêm để tạo mục mới.' },
      dateAccount: { title: 'Ngày & trả bằng gì', text: 'Mặc định hôm nay. Chọn thẻ / ví / tiền mặt đã dùng — chưa có thì chọn "+ Thêm thẻ / ví…".' },
      split: { title: 'Ai chịu khoản này?', text: 'Bạn trả hết thì để "Mình trả". Đi chung thì chọn Chia đều (hoặc Trả hộ, Tự nhập) rồi chọn những người đi cùng — app tự ghi mỗi người nợ bạn bao nhiêu.' },
      ai: { title: 'Lười gõ?', text: 'Bấm AI quét để đọc email ngân hàng (biến động số dư, sao kê), ảnh chụp màn hình hay file PDF — app điền giúp, bạn chỉ cần duyệt lại.' },
      save: { title: 'Lưu', text: 'Xong thì bấm Lưu. Ghi nhầm cứ vào Sổ chi chạm vào sửa lại.' },
    },
  },

  /* ============ SỔ CHI ============ */
  /* Sổ chi (danh sách giao dịch) */
  tx: {
    // Ô tìm kiếm
    search: 'Tìm',
    searchAria: 'Tìm giao dịch',
    // Khi không có khoản nào
    empty: 'Chưa có khoản nào',
    // Trên từng dòng giao dịch có chia tiền
    sharedTag: 'chia',
    myShare: 'mình {amount}',
    // Dòng chuyển tiền giữa hai nguồn
    transferMeta: '{from} → {to}',
  },

  /* ============ AI QUÉT: ĐỌC EMAIL, ẢNH, PDF ============ */
  /* Bảng "Nhập tự động" (AI quét ảnh / PDF / email ngân hàng) */
  importer: {
    title: 'Nhập tự động',

    // Chọn cách đọc (hai nút trên cùng) + dòng ghi chú riêng tư bên dưới
    modeAria: 'Cách đọc',
    modeAi: 'Dùng AI',
    modeLocal: 'Trên máy',
    privacyLocal: 'Đọc ngay trên điện thoại, không gửi dữ liệu đi đâu. Đọc được email và PDF (ảnh chụp cần AI).',
    privacyAiRedact: 'Che họ tên, số thẻ, số tài khoản, sđt trước khi gửi AI. Ảnh chụp gửi nguyên ảnh — nên cắt bớt phần thông tin cá nhân.',
    privacyAiNoRedact: 'Đang tắt che thông tin cá nhân — bật lại trong Cài đặt → AI nhập tự động.',

    // Khi chưa có API key
    needKey: 'Cần API key (Gemini hoặc Claude) để AI đọc ảnh và email.',
    enterKey: 'Nhập API key',

    // Nút quét ảnh / PDF
    fileAi: 'Quét ảnh / file PDF',
    fileLocal: 'Mở file sao kê PDF',
    fileAiSub: 'Ảnh thông báo, file sao kê PDF',
    fileLocalSub: 'File PDF tải từ ngân hàng',

    // Nút đọc email
    gmail: 'Đọc email ngân hàng',
    gmailSubAccount: 'Biến động số dư, sao kê · {account}',
    gmailSubNone: 'Biến động số dư, sao kê — chọn hộp thư',
    switchGmail: 'Đổi tài khoản Gmail',
    openGmailApi: 'Mở trang bật Gmail API',

    // Dòng "đang làm…" và lỗi
    busyFile: 'Đang đọc file…',
    busyOpen: 'Đang mở {name}…',
    busyAi: 'AI đang đọc…',
    busyGmail: 'Đang mở Gmail…',
    busyAiEmails: 'AI đang đọc {n} email…',
    localPdfOnly: 'Chế độ "Trên máy" chỉ đọc được file PDF. Ảnh chụp cần chuyển sang "Dùng AI".',

    // Không tìm thấy gì
    empty: 'Không tìm thấy giao dịch mới',
    emptyTryAi: 'Thử "Dùng AI" nếu ngân hàng của bạn có định dạng lạ.',
    retry: 'Thử lại',

    // Danh sách chờ duyệt
    source: 'Nguồn',
    pickRow: 'Chọn khoản này',
    tagShared: 'chia',
    tagDup: 'trùng?',
    tagOdd: 'số lạ?',
    mine: 'mình {amount}',
    edit: 'Sửa',
    add: 'Thêm {n} khoản',
    hideSent: 'Ẩn nội dung đã gửi AI',
    showSent: 'Xem nội dung đã gửi AI',

    // Ô "Giới hạn" khi quét Gmail
    limits: {
      rangeSince: 'Từ lần trước',
      rangeDays: '{n} ngày',
      sinceDate: 'từ {date}',
      sinceNever: '30 ngày (chưa đọc lần nào)',
      allBanks: 'mọi ngân hàng',
      customQuery: 'Đang dùng bộ lọc tự gõ trong Cài đặt',
      summary: '{range} · tối đa {max} email · {banks}',
      done: 'Xong',
      open: 'Giới hạn',
      timeLabel: 'Thời gian',
      maxLabel: 'Tối đa mỗi lần',
      maxOption: '{n} email',
      banksLabel: 'Chỉ đọc email của (không chọn = tất cả)',
      customHint: 'Bạn đang có bộ lọc tự gõ (Cài đặt → AI nhập tự động) — xoá trống ô đó thì các giới hạn này mới có tác dụng.',
    },
  },

  /* ============ NGÂN SÁCH (và chữ ngày tháng dùng khắp app) ============ */
  /* Ngân sách (tab Ngân sách) */
  budget: {
    // Khi tháng này chưa lập ngân sách
    empty: 'Chưa có ngân sách',
    reusePrev: 'Dùng lại tháng trước',
    createNew: 'Lập mới',

    // Thanh "Lương" trên đầu; {amount} là số tiền
    incomeBar: 'Lương **{amount}**',
    unallocated: 'chưa chia {amount}',
    overAllocated: 'lố {amount}',
    editBudget: 'Sửa ngân sách',
    tapHint: 'Chạm vào từng mục để sửa số tiền',

    // Tên nhóm khi xem ngân sách
    viewSpend: 'Chi tiêu',
    viewFixed: 'Cố định',

    // Chữ nhỏ bên phải mỗi mục
    over: 'lố {amount}',
    left: 'còn {amount}',

    // Bảng sửa nhanh một mục (chạm vào mục)
    title: 'Ngân sách',
    spent: 'Đã chi **{amount}**',
    limitThisMonth: 'Ngân sách tháng này',
    save: 'Lưu',
    markPaid: 'Ghi đã chi {amount}',
    // Tên giao dịch khi bấm "Ghi đã chi" mà mục không có tên
    fixedTxName: 'Khoản cố định',
    removeLine: 'Bỏ khỏi ngân sách',

    // Bảng lập / sửa cả ngân sách
    incomeThisMonth: 'Thu nhập tháng này',
    groupFixed: 'Khoản cố định',
    groupSpend: 'Chi tiêu linh hoạt',
    groupInstallment: 'Trả góp',
    allocated: 'Đã phân bổ {amount}',
    allocatedLeft: 'còn {amount}',
    allocatedOver: 'vượt {amount}',

    // Chữ ngày tháng dùng khắp app (tên kỳ, "Hôm nay", thứ trong tuần)
    dates: {
      month: 'Tháng {m}',
      monthYear: 'Tháng {m}/{y}',
      today: 'Hôm nay',
      yesterday: 'Hôm qua',
      // Thứ + ngày, vd "T2, 03/11"
      weekdayDate: '{wd}, {date}',
      sun: 'CN',
      mon: 'T2',
      tue: 'T3',
      wed: 'T4',
      thu: 'T5',
      fri: 'T6',
      sat: 'T7',
    },
  },

  /* ============ THẺ TÍN DỤNG, TRẢ GÓP (và tên cột trong file Excel) ============ */
  /* Sao kê thẻ tín dụng (tab Thẻ) + bảng thêm / sửa trả góp */
  card: {
    // Ô chọn thẻ khi có nhiều thẻ
    chooseCard: 'Chọn thẻ',

    // Thẻ lớn trên cùng
    due: 'Hạn trả {date}',
    txCount: 'Giao dịch ({count})',
    refunds: 'Hoàn tiền',
    installmentLine: 'Trả góp {name}',

    // Mục "Theo danh mục"
    byCategory: 'Theo danh mục',
    payButton: 'Ghi đã trả thẻ',
    txUnit: '{count} giao dịch',

    // Mục "Trả góp"
    installments: 'Trả góp',
    add: '+ Thêm',
    empty: 'Chưa có',
    progress: 'Kỳ {paid}/{months} · còn {amount}',
    paidOff: 'Đã trả xong {period}',
    tapToSetTerm: 'Chạm để nhập kỳ hạn',
    rate: 'lãi {rate}%/năm',
    notStarted: 'chưa tới kỳ',

    // Nút ẩn / xem danh sách giao dịch
    hide: 'Ẩn',
    show: 'Xem',

    // Bảng thêm / sửa trả góp
    editTitle: 'Sửa trả góp',
    addTitle: 'Thêm trả góp',
    // Tên danh mục tự tạo cho mỗi khoản trả góp
    categoryName: 'Góp {name}',
    name: 'Tên',
    namePlaceholder: 'Điện thoại, laptop…',
    principal: 'Số tiền gốc',
    principalPlaceholder: 'Giá mua trả góp',
    term: 'Kỳ hạn (tháng)',
    termOther: 'Khác',
    termOtherAria: 'Số tháng khác',
    ratePerYear: 'Lãi suất %/năm',
    fee: 'Phí chuyển đổi',
    monthly: 'Mỗi kỳ trả',
    monthlyManual: '(đã sửa tay)',
    monthlyAuto: '(tự tính)',
    useAuto: 'Dùng số tự tính {amount}',
    firstPeriod: 'Kỳ trả đầu tiên',
    card: 'Thẻ',
    totalPay: 'Tổng phải trả {amount}',
    interestFee: 'tiền lãi + phí {amount}',
    paidOffBy: 'trả xong {period}',
    save: 'Lưu',
    delete: 'Xóa',
    deleteConfirm: 'Xóa trả góp {name}?',

    // Tên trang và tên cột trong file Excel xuất ra (Cài đặt → Xuất Excel)
    excel: {
      sheetTx: 'Giao dịch',
      sheetBudget: 'Ngân sách',
      sheetInstallment: 'Trả góp',
      sheetLists: 'Danh mục & nguồn',
      colDate: 'Ngày',
      colPeriod: 'Kỳ',
      colMerchant: 'Nội dung',
      colCategory: 'Danh mục',
      colType: 'Loại',
      colAccount: 'Nguồn tiền',
      colAmount: 'Số tiền',
      colMyShare: 'Mình chịu',
      colOtherShare: 'Bên kia chịu',
      colOther: 'Bên kia',
      colReimbursed: 'Đã hoàn',
      colNote: 'Ghi chú',
      colBudget: 'Ngân sách',
      colName: 'Tên',
      colCard: 'Thẻ',
      colPrincipal: 'Tiền gốc',
      colMonths: 'Số kỳ',
      colRate: 'Lãi %/năm',
      colFee: 'Phí chuyển đổi',
      colMonthly: 'Mỗi kỳ',
      colFirstPeriod: 'Kỳ đầu',
      colGroup: 'Nhóm',
      typeIncome: 'Thu',
      typeRefund: 'Hoàn tiền',
      typeSpend: 'Chi',
      typeTransfer: 'Chuyển tiền',
      typeLend: 'Cho vay',
      typeBorrow: 'Đi vay',
      company: 'Công ty',
      incomeRow: 'Lương (thu nhập)',
      groupAccount: 'Nguồn tiền',
      groupCategory: 'Danh mục',
      kindCredit: 'Thẻ tín dụng',
      kindEwallet: 'Ví điện tử',
      kindBank: 'Ngân hàng',
      kindCash: 'Tiền mặt',
      catSpend: 'Chi tiêu',
      catFixed: 'Cố định',
      catInstallment: 'Trả góp',
      catIncome: 'Khoản thu',
    },
  },

  /* ============ CHIA TIỀN ============ */
  /* Chia tiền (tab người yêu / công ty trả lại) */
  split: {
    // Tên bên kia khi là công ty (tên người yêu lấy trong Cài đặt)
    company: 'Công ty',

    // Thẻ lớn trên cùng
    owes: '{name} còn nợ',
    // Khi chưa chia tiền với ai
    empty: 'Chưa chia tiền với ai. Lúc ghi khoản chi, chọn Chia đều rồi chọn những người đi cùng.',
    settleAll: 'Đã trả đủ',
    settleAllConfirm: '{name} đã trả đủ {amount}?',

    // Danh sách đang chờ trả
    pending: 'Đang chờ ({count})',
    noDebt: 'Hết nợ',
    pendingLine: '{date} · tổng {amount}',
    paidSoFar: 'đã trả {amount}',
    withOthers: 'chia cùng {n} người khác',

    // Danh sách đã trả xong
    done: 'Đã trả ({count})',
    hide: 'Ẩn',
    show: 'Xem',
    paidMark: '{amount} ✓',

    // Bảng nhập số tiền đã trả lại
    owed: 'Cần trả: **{amount}**',
    paid: 'Đã trả',
    payFull: 'Trả đủ',
    notPaid: 'Chưa trả',
    save: 'Lưu',
  },

  /* ============ SỔ CHUNG ============ */
  /* Sổ chung */
  shared: {
    // Chữ chờ khi đang tải
    loading: 'Đang tải…',

    // Màn chưa đăng nhập
    eyebrow: 'Sổ chung',
    intro: 'Ghi chung với người yêu, bạn bè, gia đình. Ai trả, ai nợ — app tự tính.',
    opening: 'Đang mở…',
    login: 'Đăng nhập Google',
    joinHint: 'Đăng nhập để vào sổ được mời.',
    privacyHint: 'Chỉ những khoản ghi trong sổ chung mới được chia sẻ. Ví riêng của bạn vẫn chỉ mình bạn thấy.',

    // Danh sách sổ, tạo sổ mới, đăng xuất
    newLedgerChip: 'Sổ mới',
    noLedger: 'Chưa có sổ chung nào',
    createLedger: 'Tạo sổ chung',
    logout: 'Đăng xuất sổ chung ({email})',
    newLedgerTitle: 'Sổ chung mới',
    newLedgerPlaceholder: 'VD: Hai đứa mình, Nhà mình, Đà Lạt 12/2026',

    // Tên người trong sổ
    you: 'Bạn',
    formerMember: 'Người cũ',

    // Lời mời gửi kèm link
    inviteText: 'Vào sổ chung "{name}" với mình nha',

    // Thẻ số dư đầu sổ
    youGet: 'Bạn được nhận lại',
    youOwe: 'Bạn đang nợ',
    settled: 'Hết nợ',
    groupSummary: 'Cả nhóm chi {group} · phần bạn {mine}',
    addEntry: 'Thêm khoản chung',

    // Thẻ "Cần trả"
    toPayTitle: 'Cần trả',
    tapWhenPaid: 'Chạm khi đã chuyển tiền',

    // Thẻ thành viên
    rename: 'Đổi tên',
    linkCopied: 'Đã chép link',
    invite: 'Mời',
    renameTitle: 'Đổi tên sổ',

    // Danh sách khoản đã ghi
    noEntries: 'Chưa có khoản nào',
    settleLine: '{from} trả {to}',
    settleMeta: 'Trả nợ',
    paidBy: '{name} trả',
    yourShare: 'phần bạn {amount}',

    // Rời sổ
    leaveConfirm: 'Rời sổ "{name}"? Các khoản đã ghi vẫn còn cho người khác xem.',
    leave: 'Rời sổ này',

    // Bảng xem một lần trả nợ
    settleSheetTitle: 'Trả nợ',
    settleDetail: '{from} đã trả {to} **{amount}** ngày {day}',
    deleteSettleConfirm: 'Xoá lần trả nợ này?',
    delete: 'Xoá',

    // Bảng thêm / sửa khoản chung
    form: {
      titleEdit: 'Sửa khoản chung',
      titleNew: 'Khoản chung',
      amountAria: 'Số tiền',
      titlePlaceholder: 'Khoản gì? (Ăn tối, tiền nhà…)',
      dateAria: 'Ngày',
      whoPaid: 'Ai trả',
      splitFor: 'Chia cho',
      splitEqual: 'Chia đều',
      splitCustom: 'Tự nhập',
      left: 'Còn {amount} chưa chia',
      over: 'Dư {amount}',
      perPerson: 'Mỗi người {amount}',
      perPersonMine: ' · phần bạn {amount}',
      toWallet: 'Ghi vào ví của mình',
      toWalletSub: 'Phần của bạn tính vào ngân sách',
      accountAria: 'Nguồn tiền',
      categoryAria: 'Danh mục',
      save: 'Lưu',
      deleteConfirm: 'Xoá khoản này khỏi sổ chung? Mọi người sẽ không thấy nữa.',
      delete: 'Xoá',
      // Ghi chú tự thêm vào giao dịch trong ví riêng
      walletNote: 'Sổ chung: {name}',
    },

    // Bảng ghi đã trả nợ
    settleForm: {
      entryTitle: 'Trả nợ',
      sent: 'Đã chuyển',
      submit: 'Ghi đã trả',
    },

    // Bảng đặt tên sổ
    ledgerName: 'Tên sổ',
    save: 'Lưu',
  },

  /* ============ CÀI ĐẶT ============ */
  /* Cài đặt */
  settings: {
    // Danh sách mục ở màn Cài đặt (tiêu đề + dòng nhỏ bên dưới)
    menu: {
      account: 'Tài khoản & đăng xuất',
      accountNoLogin: 'Chưa đăng nhập Google',
      help: 'Hướng dẫn sử dụng',
      helpSub: 'Ghi chi tiêu, chia tiền, ngân sách, sao lưu…',
      look: 'Giao diện',
      lookSub: 'Màu chủ đạo, hình đại diện',
      money: 'Tiền & ngày trong tháng',
      moneySub: 'Đang có {cash} · lương ngày {day}',
      sources: 'Nguồn tiền',
      sourcesSub: '{n} thẻ / ví / tài khoản',
      categories: 'Danh mục',
      categoriesSub: '{n} danh mục',
      split: 'Chia tiền',
      splitSub: '{n} người hay chia cùng · {k} tỉ lệ riêng',
      ai: 'AI nhập tự động',
      aiUsing: 'Đang dùng {provider}',
      aiNoKey: 'Chưa nhập API key',
      data: 'Sao lưu & dữ liệu',
      dataDrive: 'Drive: {email}',
      dataSub: 'Xuất Excel, sao lưu',
    },

    // Mục "Tiền & ngày trong tháng"
    money: {
      cashOnHand: 'Tiền đang có',
      savingsFund: 'Quỹ tiết kiệm riêng',
      partnerName: 'Người hay chia tiền cùng',
      daysTitle: 'Ngày trong tháng',
      cutoffDay: 'Chốt thẻ',
      dueDay: 'Hạn trả',
      salaryDay: 'Lương',
    },

    // Mục "Nguồn tiền" và "Danh mục"
    addSource: 'Thêm nguồn tiền',
    groupSpend: 'Chi tiêu',
    groupFixed: 'Cố định',
    groupIncome: 'Khoản thu',
    addCategory: 'Thêm danh mục',

    // Mục "Cách chia tiền": dòng mô tả từng cách chia
    split: {
      company: 'công ty',
      someone: 'người kia',
      meAll: 'mình trả hết',
      otherAll: '{other} trả hết',
      ratio: 'bạn {mine} phần : mỗi người {otherPart} phần',
      meNote: '{desc} — luôn có, không chia',
      add: 'Thêm tỉ lệ riêng',
    },

    // Mục "Cách chia tiền": danh sách người hay chia cùng
    people: {
      title: 'Người hay chia tiền cùng',
      hint: 'Cũng thêm được ngay lúc ghi khoản, ở dòng "Với ai?".',
      empty: 'Chưa có ai',
      add: 'Thêm người',
      formNew: 'Thêm người',
      formEdit: 'Sửa tên',
      name: 'Tên',
      namePlaceholder: 'Lan, Mẹ, Công ty…',
      save: 'Lưu',
      delete: 'Xóa',
      confirmDelete: 'Xóa "{name}" khỏi danh sách? Các khoản đã chia với người này vẫn giữ nguyên.',
    },
    ratiosTitle: 'Tỉ lệ riêng',
    ratiosHint: 'Lúc ghi khoản luôn có sẵn: Mình trả · Chia đều · Trả hộ · Tự nhập. Hay chia lệch thì thêm tỉ lệ riêng, vd. "Hẹn hò 1:2": mỗi người trả gấp đôi phần bạn.',
    ratiosEmpty: 'Chưa có tỉ lệ riêng',

    // Bảng thêm / sửa cách chia
    splitForm: {
      titleNew: 'Thêm tỉ lệ riêng',
      titleEdit: 'Sửa cách chia',
      name: 'Tên',
      namePlaceholder: 'Đi nhóm 1:3, Ăn chung 2:1…',
      withPartner: 'Với {name}',
      withCompany: 'Với công ty',
      minePart: 'Phần mình',
      otherPart: 'Mỗi người khác',
      example: 'Ví dụ {total} chia với 1 người: bạn {mine}, người kia {back}.',
      save: 'Lưu',
      delete: 'Xóa',
    },

    // Mục "AI nhập tự động"
    ai: {
      chooseAria: 'Chọn AI',
      apiKey: '{provider} API key',
      checking: 'Đang thử…',
      check: 'Kiểm tra',
      getKeyAt: 'Lấy key tại',
      keyLocal: '. Key chỉ lưu trên máy này.',
      model: 'Mô hình Gemini',
      privacyTitle: 'Bảo vệ thông tin',
      redact: 'Che thông tin cá nhân trước khi gửi AI',
      redactSub: 'Họ tên, số thẻ, số tài khoản, sđt, email, địa chỉ',
      privacyWords: 'Tên cần che (cách nhau dấu phẩy)',
      privacyWordsPlaceholder: 'Họ tên của bạn, tên người thân…',
      privacyHint: 'Muốn tuyệt đối riêng tư: trong màn hình AI quét chọn "Trên máy" — đọc email, file PDF ngay trên điện thoại, không gửi đi đâu.',
      gmailTitle: 'Gmail nhận sao kê',
      gmailPick: 'Chọn khi đọc email lần đầu',
      gmailChange: 'Đổi',
      gmailQuery: 'Bộ lọc Gmail',
      gmailQueryPlaceholder: 'Để trống: biến động số dư + sao kê 30 ngày',
      gmailHint: 'Để trống là app tự tìm email biến động số dư, biên lai, sao kê của các ngân hàng / ví phổ biến.',
    },

    // Mục "Tài khoản & đăng xuất"
    account: {
      wipeConfirm: 'Đăng xuất mọi tài khoản và XOÁ toàn bộ dữ liệu trên máy này?\n\n',
      wipeHasDrive: 'Bản sao lưu trên Google Drive vẫn còn — đăng nhập lại là khôi phục được.',
      wipeNoDrive: 'Bạn CHƯA sao lưu Google Drive — dữ liệu sẽ mất hẳn.',
      driveTitle: 'Sao lưu Google Drive',
      notLoggedIn: 'Chưa đăng nhập',
      driveLogoutConfirm: 'Đăng xuất Google Drive? Máy này sẽ ngừng tự sao lưu.',
      logout: 'Đăng xuất',
      login: 'Đăng nhập',
      gmailTitle: 'Gmail đọc sao kê',
      borrowedTitle: 'Dùng máy mượn / đưa máy cho người khác',
      borrowedHint: 'Đăng xuất hết và xoá mọi dữ liệu của bạn trên máy này. App trở về như lúc mới cài.',
      wipeButton: 'Đăng xuất & xoá dữ liệu trên máy',
    },

    // Mục "Sao lưu & dữ liệu"
    data: {
      restoreConfirm: 'Thay toàn bộ dữ liệu hiện tại bằng file sao lưu?',
      badFile: 'File không đúng định dạng sao lưu của app.',
      viewTitle: 'Xem dữ liệu',
      viewHint: 'File Excel gồm giao dịch, ngân sách, trả góp — mở bằng Excel hoặc Google Trang tính.',
      exporting: 'Đang tạo file…',
      exportExcel: 'Xuất file Excel',
      jsonTitle: 'File sao lưu (.json)',
      jsonHint: 'Dùng để chuyển dữ liệu sang máy khác hoặc khôi phục lại vào app, không dùng để xem.',
      download: 'Tải về',
      restore: 'Khôi phục',
      resetTitle: 'Làm lại từ đầu',
      resetAllConfirm: 'Xóa mọi thứ (cả danh mục, nguồn tiền) và cài đặt lại như mới?',
      resetAll: 'Như mới',
      clearConfirm: 'Xóa toàn bộ giao dịch, trả góp và ngân sách?',
      clear: 'Xóa hết',
    },
  },

  /* ============ THÊM / SỬA NGUỒN TIỀN, DANH MỤC ============ */
  /* Bảng thêm / sửa nguồn tiền và danh mục (Cài đặt, hoặc nút Thêm trong bảng ghi khoản) */
  manage: {
    // Tên các loại nguồn tiền
    kindCredit: 'Thẻ tín dụng',
    kindEwallet: 'Ví điện tử',
    kindBank: 'Ngân hàng',
    kindCash: 'Tiền mặt',

    // Bảng nguồn tiền (thẻ / ví)
    accountTitleEdit: 'Sửa nguồn tiền',
    accountTitleNew: 'Thêm nguồn tiền',
    accountName: 'Tên',
    accountNamePlaceholder: 'Vietcombank, ZaloPay, Ví tiền mặt…',
    accountKindAria: 'Loại',
    accountInUseTitle: 'Đang có giao dịch dùng nguồn này',
    confirmDeleteAccount: 'Xóa {name}?',

    // Loại danh mục (ba nút)
    catKindSpend: 'Chi tiêu',
    catKindFixed: 'Cố định',
    catKindIncome: 'Khoản thu',

    // Bảng danh mục
    categoryTitleEdit: 'Sửa danh mục',
    categoryTitleNew: 'Thêm danh mục',
    categoryNamePlaceholder: 'Tên danh mục',
    colorAria: 'Màu',
    iconAria: 'Biểu tượng',
    confirmDeleteCategory: 'Xóa danh mục {name}?',

    // Nút dưới cùng (dùng chung cho hai bảng)
    save: 'Lưu',
    delete: 'Xóa',
    inUseCannotDelete: 'Đang có giao dịch, không xóa được',
  },

  /* ============ SAO LƯU GOOGLE DRIVE ============ */
  /* Sao lưu Google Drive */
  drive: {
    // Hỏi khi đăng nhập Drive mà bản trên Drive nhiều dữ liệu hơn máy này (máy mới / vừa xoá sạch)
    remoteHasMore: 'Google Drive đang có bản sao lưu {n} giao dịch (sửa lúc {remote}). Máy này chỉ có {m} giao dịch.\n\nTải bản trên Drive về máy này?',
    overwriteConfirm: 'Ghi đè bản trên Google Drive bằng dữ liệu của máy này?\n\nBản trên Drive ({n} giao dịch) sẽ bị thay thế và không lấy lại được.',
    keptRemote: 'Đã giữ nguyên bản trên Google Drive. Máy này chưa sao lưu.',
    // Trạng thái sao lưu (thẻ Google Drive ở mục Sao lưu & dữ liệu)
    status: {
      off: 'Chưa bật',
      syncing: 'Đang sao lưu…',
      ok: 'Đã sao lưu',
      needLogin: 'Cần đăng nhập lại',
      error: 'Lỗi sao lưu',
    },

    // Thẻ Google Drive
    title: 'Google Drive',
    notConfigured: 'Chưa cấu hình Google.',
    intro: 'Tự lưu vào Drive mỗi khi có thay đổi.',
    login: 'Đăng nhập Google',
    account: 'Tài khoản',
    statusLabel: 'Trạng thái',
    lastSync: 'Lần cuối',
    relogin: 'Đăng nhập lại',
    syncNow: 'Sao lưu ngay',
    logoutConfirm: 'Ngừng sao lưu và đăng xuất Google? Bản trên Drive vẫn được giữ.',
    logout: 'Đăng xuất',

    // Dải nhắc ở trang Tổng quan khi sao lưu bị ngắt
    bannerNeedLogin: 'Drive tạm dừng sao lưu · chạm để đăng nhập',
    bannerError: 'Drive lỗi sao lưu · chạm để xem',

    // Thông báo khi đăng nhập hết hạn
    sessionExpired: 'Phiên đăng nhập hết hạn. Bấm "Đăng nhập lại" để tiếp tục sao lưu.',

    // Hỏi khi Drive có bản sao lưu mới hơn máy này
    unknownTime: 'chưa rõ',
    newerConfirm: 'Google Drive có bản sao lưu mới hơn (sửa lúc {remote}).\nBản trên máy này sửa lúc {local}.\n\nTải bản trên Drive về máy này?',
  },

  /* ============ GIAO DIỆN: MÀU, HÌNH ĐẠI DIỆN ============ */
  /* Chọn giao diện (màu chủ đạo + hình đại diện) */
  look: {
    accentLabel: 'Màu chủ đạo',
    avatarLabel: 'Hình đại diện',
    // Tên các màu chủ đạo
    accents: {
      rose: 'Hồng',
      ocean: 'Xanh biển',
      forest: 'Xanh lá',
      violet: 'Tím',
      amber: 'Cam',
      slate: 'Xám',
    },
    // Tên các hình đại diện
    avatars: {
      girl: 'Nữ',
      boy: 'Nam',
      person: 'Ẩn',
    },
  },

  /* ============ HƯỚNG DẪN SỬ DỤNG (Cài đặt → Hướng dẫn sử dụng) ============ */
  /*
   * Hướng dẫn sử dụng (Cài đặt → Hướng dẫn sử dụng). Mỗi mục: q = câu hỏi, a = câu trả lời.
   * Cách viết câu trả lời:
   *   - Dòng trống (\n\n) = sang đoạn mới.
   *   - Các dòng bắt đầu bằng "1. ", "2. "… = danh sách đánh số.
   *   - Các dòng bắt đầu bằng "- " = danh sách gạch đầu dòng.
   *   - **chữ** = in đậm.
   */
  guide: {
    /* Nút trên cùng: chạy lại phần hướng dẫn chỉ từng nút */
    replayTour: '**Xem lại hướng dẫn nhanh** — chỉ từng nút trên màn hình',

    addExpense: {
      q: 'Ghi một khoản chi',
      a:
        '1. Bấm nút **+** to ở giữa thanh dưới.\n' +
        '2. Nhập số tiền, chọn danh mục (Ăn uống, Mua sắm…).\n' +
        '3. Ghi chú nếu muốn (Shopee, Grab…).\n' +
        '4. **Ngày**: mặc định hôm nay, chạm để đổi. **Trả bằng**: thẻ / ví / tiền mặt nào — chọn **+ Thêm thẻ / ví…** nếu chưa có.\n' +
        '5. **Ai chịu khoản này?** — để **Mình trả** nếu bạn trả hết (xem mục chia tiền bên dưới).\n' +
        '6. Bấm **Lưu**.',
    },

    loan: {
      q: 'Cho vay, đi vay',
      a:
        'Bấm **+** → **Chuyển** → **Cho ai vay / vay của ai?** (hoặc vào màn **Chia tiền & vay nợ** → **Cho vay** / **Đi vay**). Chọn người, số tiền, ví → **Lưu**.\n\n' +
        'Khoản vay không tính là chi tiêu, chỉ cộng trừ vào số dư ví. Khi trả: chạm vào khoản đó → gõ số **Đã trả lại**.',
    },

    reconcile: {
      q: 'Đối chiếu sao kê thẻ',
      a: 'Tab **Thẻ** → **Đối chiếu sao kê** → chọn file sao kê PDF ngân hàng gửi. App chỉ ra khoản **chưa ghi** (bấm Thêm), khoản **lệch số tiền** (bấm Sửa), và khoản có trong app mà sao kê không có (nghi ghi trùng / nhầm thẻ).',
    },

    extras: {
      q: 'Lịch tiền, tổng kết tháng, ẩn số tiền',
      a: '**Lịch tiền**: màn chính → ô **Sắp tới**, xem ngày lương, hạn thẻ, khoản định kỳ trong tháng. **Tổng kết tháng**: đầu tháng app tự nhắc, hoặc vào Báo cáo → **Tổng kết tháng**. **Ẩn số tiền**: chạm hình con mắt góc trên. **Gợi ý ngân sách**: Ngân sách → Sửa ngân sách → **Gợi ý theo các tháng trước**.',
    },

    goals: {
      q: 'Để dành cho mục tiêu (du lịch, mua máy…)',
      a: 'Màn chính → thẻ **Mục tiêu** → **Thêm mục tiêu**: tên, số tiền cần, hạn. App tính mỗi tháng cần bỏ bao nhiêu. Mỗi lần để dành được thì bấm **Bỏ thêm**.',
    },

    migrate: {
      q: 'Chuyển dữ liệu từ Money Lover, Misa',
      a: 'Trong app cũ, xuất dữ liệu ra file CSV hoặc Excel. Rồi vào **Cài đặt → Sao lưu & dữ liệu → Nhập từ app khác** → chọn file. App tự dò cột, cho xem trước rồi mới nhập. Nhập lại cùng file thì không bị trùng.',
    },

    remind: {
      q: 'Nhắc ghi chi tiêu, nhắc hạn trả thẻ',
      a: '**Cài đặt → Nhắc nhở** → **Cho phép thông báo**, rồi bật các nhắc nhở và chọn giờ. iPhone phải thêm app ra màn hình chính trước. Hôm nào chưa ghi khoản nào, màn chính cũng hiện lời nhắc.',
    },

    lock: {
      q: 'Khoá app bằng vân tay / Face ID',
      a: '**Cài đặt → Khoá app** → bật, đặt mã PIN 4–6 số, rồi bật **Mở bằng vân tay / Face ID** nếu máy hỗ trợ. Quên mã PIN thì phải xoá dữ liệu trên máy và khôi phục từ Google Drive, nên nhớ bật sao lưu.',
    },

    income: {
      q: 'Ghi tiền lương, tiền thưởng',
      a: 'Bấm **+** → chọn **Thu** ở góc trên → nhập số tiền → **Lưu**. Tiền thu hiện màu xanh trong Sổ chi.',
    },

    refund: {
      q: 'Được hoàn tiền / trả hàng',
      a: 'Bấm **+** → chọn **Hoàn** → nhập số tiền được trả lại → chọn danh mục của món đó (vd. Mua sắm) và thẻ / ví nhận lại tiền → **Lưu**. Số này trừ bớt vào chi tiêu và vào tiền phải trả thẻ.',
    },

    edit: {
      q: 'Sửa hoặc xoá khoản đã ghi',
      a: 'Vào **Sổ chi**, chạm vào khoản cần sửa → sửa rồi **Lưu**, hoặc bấm **Xóa**. Nhập lố tay? Cứ chạm vào sửa lại.',
    },

    split: {
      q: 'Chia tiền với người thân, bạn bè',
      a:
        'Lúc ghi khoản chi, chọn cách chia ở hàng cuối: **Chia đều** (chia đều cho bạn và những người đi cùng), **Trả hộ** (người khác trả hết), **Tự nhập** (gõ số tiền từng người). ' +
        'Rồi chọn **Với ai?** — chọn được nhiều người; chưa có ai thì bấm **+ Người khác** gõ tên (Lan, Mẹ, Công ty…). ' +
        'App chỉ tính phần của bạn vào ngân sách, phần còn lại ghi là người đó nợ.\n\n' +
        'Khi họ trả: tab **Chia tiền** (hoặc ô **… nợ** ở màn chính) → chọn người → chạm khoản → **Trả đủ**.\n\n' +
        'Hay chia lệch (vd. 1:2, mỗi người trả gấp đôi bạn): bấm **+ Tỉ lệ riêng** ngay lúc ghi. Sửa tên / xoá người: **Cài đặt → Chia tiền**.',
    },

    /* Chỉ hiện khi app có bật sổ chung */
    shared: {
      q: 'Sổ chung với nhiều người',
      a:
        'Bấm biểu tượng **nhóm người** ở góc trên → đăng nhập Google → **Tạo sổ chung** → bấm **Mời** để gửi link cho mọi người.\n\n' +
        'Ai trả gì thì ghi vào sổ, app tự tính ai nợ ai và gợi ý chuyển tiền ít lần nhất. Ví riêng của bạn không ai thấy.',
    },

    wallet: {
      q: 'Biết mình đang có bao nhiêu tiền',
      a:
        'Ở màn chính, thẻ **Ví của bạn** → **Nhập số dư**: gõ số tiền đang có trong từng ví / tài khoản (thẻ tín dụng thì gõ số đang nợ). ' +
        'Từ đó app tự cộng trừ theo các khoản bạn ghi và hiện **Tổng tài sản**.\n\n' +
        'Chuyển tiền giữa các ví của mình (trả nợ thẻ từ tài khoản, nạp Momo, rút tiền mặt): bấm **+** → chọn **Chuyển**, ' +
        'hoặc nút **Chuyển tiền** trong thẻ Ví. Khoản chuyển không tính là chi hay thu.\n\n' +
        'Số dư lệch với thực tế? Bấm **Sửa số dư** nhập lại số đúng là xong.',
    },
    recurring: {
      q: 'Khoản lặp lại hằng tháng (tiền nhà, Netflix, lương)',
      a:
        'Lúc ghi khoản đó lần đầu, bật **Lặp lại hàng tháng**. Các tháng sau, tới đúng ngày app tự ghi vào Sổ chi (lúc bạn mở app).\n\n' +
        'Xem, sửa số tiền, tạm dừng hoặc xoá ở **Cài đặt → Khoản định kỳ**.',
    },
    report: {
      q: 'Xem chi tiêu tăng hay giảm',
      a:
        'Màn chính → thẻ **Chi tiêu** → **Báo cáo**: chi và thu 6 tháng gần đây, tháng này so với tháng trước, ' +
        'mục nào đang tăng mạnh, và xu hướng từng danh mục. Chạm vào cột tháng để xem số của tháng đó.',
    },
    budget: {
      q: 'Đặt ngân sách tháng',
      a:
        'Tab **Ngân sách** → **Lập mới** → nhập thu nhập và số tiền định tiêu cho từng mục (để trống mục nào không cần).\n\n' +
        'Màn Tổng quan sẽ báo **Còn tiêu được** bao nhiêu. Chạm từng mục trong Ngân sách để sửa; khoản cố định (gửi gia đình, gym…) có nút **Ghi đã chi** cho nhanh.',
    },

    card: {
      q: 'Thẻ tín dụng: kỳ sao kê, ngày trả, trả góp',
      a:
        'Đặt **ngày chốt** và **hạn trả** ở **Cài đặt → Tiền & ngày**. Ngày chốt chỉ dùng cho **sao kê thẻ**: khoản quẹt sau ngày chốt nằm ở kỳ trả sau (xem khoảng ngày dưới tên kỳ ở tab Thẻ). Ngân sách, sổ chi, báo cáo luôn tính theo **tháng dương lịch** (1 → 30/31).\n\n' +
        'Tab **Thẻ** cho biết kỳ này phải trả bao nhiêu. Trả góp: tab **Thẻ → Trả góp → + Thêm**, nhập tiền gốc, số tháng, lãi — app tự tính mỗi kỳ.\n\n' +
        'Không dùng thẻ? Xoá thẻ ở **Cài đặt → Nguồn tiền**, phần thẻ sẽ tự ẩn.',
    },

    scan: {
      q: 'Đọc email ngân hàng, ảnh chụp, sao kê',
      a:
        'Bấm **+** → **AI quét**:\n\n' +
        '- **Đọc email ngân hàng**: app lấy cả **email biến động số dư** (mỗi lần trừ / cộng tiền) và **email sao kê** trong 30 ngày gần nhất. Hộp thư nhận sao kê có thể khác tài khoản đăng nhập app. Bấm **Giới hạn** bên dưới để chọn chỉ đọc 7 / 30 / 90 ngày hoặc **từ lần trước**, tối đa bao nhiêu email, và chỉ email của ngân hàng nào.\n' +
        '- **Quét ảnh / file PDF**: ảnh chụp màn hình giao dịch, file sao kê tải về.\n\n' +
        'Chưa nhận email biến động? Vào app ngân hàng, bật **thông báo biến động số dư qua email** (thường miễn phí, khác với SMS tốn phí).\n\n' +
        'App liệt kê các khoản tìm được. **Chạm vào từng dòng để sửa** danh mục, số tiền, cách chia…, bỏ tick dòng không muốn, rồi bấm **Thêm**. Khoản vừa có trong email biến động vừa có trong sao kê sẽ được đánh dấu **trùng?** và tự bỏ tick.\n\n' +
        '**Dùng AI** cần key Gemini miễn phí: **Cài đặt → AI nhập tự động**. Chế độ **Trên máy** không cần key, không gửi dữ liệu đi đâu, nhưng chỉ đọc được email và PDF (ảnh chụp cần AI).',
    },

    backup: {
      q: 'Sao lưu, đổi điện thoại',
      a:
        'Dữ liệu nằm trên máy bạn. Để không mất: **Cài đặt → Sao lưu & dữ liệu → Đăng nhập Google**, app tự lưu vào Google Drive của bạn mỗi lần sửa.\n\n' +
        'Đổi máy: mở app trên máy mới → **Khôi phục từ Google Drive**. Muốn xem bằng Excel: **Xuất file Excel**.',
    },

    install: {
      q: 'Cài app lên màn hình điện thoại',
      a:
        '- **Android:** mở link bằng Chrome → nút ⋮ → **Cài đặt ứng dụng**.\n' +
        '- **iPhone:** mở bằng **Safari** → nút Chia sẻ → **Thêm vào MH chính**.',
    },

    look: {
      q: 'Đổi màu, hình đại diện, nền sáng / tối',
      a: '**Cài đặt → Giao diện** để đổi màu và hình. Nút **mặt trời / mặt trăng** ở góc trên để đổi nền sáng / tối.',
    },

    privacy: {
      q: 'Dữ liệu của tôi có ai xem được không?',
      /* {sharedNote} = câu sharedNote bên dưới (chỉ khi app có bật sổ chung), còn không thì bỏ trống */
      a: 'Không. Dữ liệu chỉ nằm trên máy bạn và Google Drive của chính bạn (thư mục ẩn, chỉ app này đọc được). Không có máy chủ nào lưu chi tiêu của bạn{sharedNote}.',
      sharedNote: ', trừ những khoản bạn tự ghi vào sổ chung',
    },
  },

  /* ============ THÔNG BÁO LỖI, TÊN MẶC ĐỊNH CHO NGƯỜI MỚI ============ */
  /* Thông báo lỗi / trạng thái (AI, Gmail, Google Drive, sổ chung) và tên mặc định cho người mới */
  errors: {
    /* --- Gemini: khi quét giao dịch bằng AI --- */
    geminiEmpty: 'Gemini không trả kết quả (có thể nội dung bị chặn), thử ảnh khác nhé.',
    geminiBadFormat: 'Gemini trả về kết quả không đúng định dạng, thử lại nhé.',
    geminiUnreadable: 'Gemini trả về kết quả không đọc được, thử lại nhé.',
    geminiBadKey: 'Gemini API key không đúng.',
    geminiNoPermission: 'API key không có quyền dùng Gemini API (kiểm tra project trong AI Studio).',
    geminiNoModel: 'Không tìm thấy mô hình "{model}". Sửa tên mô hình trong Cài đặt.',
    geminiQuota: 'Hết lượt miễn phí hôm nay hoặc gửi quá nhanh, thử lại sau nhé.',
    geminiStatus: 'Gemini báo lỗi {status}: {message}',
    geminiOffline: 'Không gửi được yêu cầu tới Gemini (mất mạng, hoặc trình chặn quảng cáo/VPN đang chặn googleapis.com).',
    geminiOther: 'Lỗi khi gọi Gemini: {message}',

    /* --- Gemini: nút "Thử kết nối" trong Cài đặt → AI nhập tự động --- */
    pingOk: 'Kết nối tốt ({model}).',
    pingEmpty: 'Gemini có trả lời nhưng rỗng.',
    pingBadKey: 'Key không đúng — copy lại key trong AI Studio.',
    pingNoPermission: 'Key không có quyền dùng Gemini API (kiểm tra project của key trong AI Studio).',
    pingNoModel: 'Không có mô hình "{model}" — thử để trống ô Mô hình hoặc gõ gemini-2.5-flash.',
    pingQuota: 'Key đúng nhưng đã hết lượt miễn phí lúc này, thử lại sau.',
    pingStatus: 'Gemini báo lỗi {status}: {message}',
    pingOffline: 'Không gửi được yêu cầu: mất mạng, hoặc trình chặn quảng cáo / VPN / DNS chặn generativelanguage.googleapis.com.',
    pingOther: 'Lỗi: {message}',

    /* --- Claude: khi quét giao dịch bằng AI --- */
    claudeRefusal: 'AI từ chối xử lý nội dung này.',
    claudeUnreadable: 'AI trả về kết quả không đọc được, thử lại nhé.',
    claudeBadKey: 'Claude API key không đúng.',
    claudeNoPermission: 'API key không có quyền dùng mô hình này.',
    claudeRateLimit: 'Gửi quá nhiều yêu cầu, đợi chút rồi thử lại.',
    claudeOffline: 'Không kết nối được tới Claude. Kiểm tra mạng.',
    claudeStatus: 'Claude báo lỗi {status}: {message}',

    /* Khi bấm AI quét mà chưa nhập key ({provider} = Gemini hoặc Claude) */
    noApiKey: 'Chưa nhập {provider} API key trong Cài đặt.',

    /* --- File PDF có mật khẩu (hộp thoại hỏi mật khẩu) --- */
    pdfWrongPassword: 'Sai mật khẩu. ',
    pdfAskPassword: 'File "{filename}" có mật khẩu.\nNhập mật khẩu (thường ngân hàng ghi trong email gửi sao kê):',
    pdfSkipped: 'Đã bỏ qua {filename}',
    pdfTooManyTries: 'Sai mật khẩu quá nhiều lần, bỏ qua {filename}',

    /* --- Đọc email ngân hàng (Gmail) --- */
    gmailApiOff: 'Gmail API chưa được bật trong project Google Cloud. Bấm link dưới, chọn "Enable", đợi 1–2 phút rồi thử lại.',
    gmailNoScope: 'App chưa được cấp quyền đọc Gmail. Bấm đọc email lại và tick ô "Xem email của bạn".',
    gmailDenied: 'Gmail từ chối truy cập: {message}',
    gmailNoConfig: 'Chưa cấu hình Google.',
    gmailNotGranted: 'Không được cấp quyền Gmail.',
    gmailUnticked: 'Bạn chưa tick ô "Xem email của bạn" lúc đăng nhập. Bấm đọc email lại và nhớ tick ô đó nhé.',
    gmailExpired: 'Phiên Gmail hết hạn, thử lại.',
    gmailStatus: 'Gmail lỗi {status}',

    /* --- Đăng nhập Google / sao lưu Google Drive --- */
    popupClosed: 'Bạn đã đóng cửa sổ đăng nhập.',
    signInFailed: 'Đăng nhập thất bại.',
    googleScriptFailed: 'Không tải được Google Sign-In. Kiểm tra kết nối mạng.',
    driveNoConfig: 'Chưa cấu hình VITE_GOOGLE_CLIENT_ID.',
    driveStatus: 'Google Drive lỗi {status}: {message}',
    googleSessionExpired: 'Phiên đăng nhập Google đã hết hạn.',

    /* --- Sổ chung (Firebase) --- */
    firebaseGoogleOff: 'Firebase chưa bật đăng nhập Google (Authentication → Sign-in method → Google).',
    firebaseWrongProject: 'Firebase không nhận tài khoản này. Vào Firebase → Authentication → Sign-in method → Google → dán Client ID của app vào ô "Allowlist client IDs from external projects" rồi Save.',
    /* Tên hiện khi tài khoản Google không có tên */
    firebaseNoName: 'Bạn',
    inviteInvalid: 'Link mời không đúng, hoặc sổ đã bị xoá.',

    /* Tên mặc định cho người mới mở app lần đầu */
    starter: {
      categories: {
        shopping: 'Mua sắm',
        food: 'Ăn uống',
        dating: 'Hẹn hò',
        transport: 'Đi lại',
        gift: 'Quà tặng',
        beauty: 'Làm đẹp',
        bills: 'Hóa đơn',
        health: 'Sức khỏe',
        fun: 'Giải trí',
        other: 'Khác',
        family: 'Gia đình',
        gym: 'Gym',
        saving: 'Tiết kiệm',
        salary: 'Lương',
        bonus: 'Thưởng',
        giftIn: 'Được tặng',
        otherIn: 'Thu khác',
      },
      accounts: {
        card: 'Thẻ tín dụng',
        bank: 'Tài khoản lương',
        momo: 'Momo',
        cash: 'Tiền mặt',
      },
      /* Tên người hay chia tiền cùng (Cài đặt → Tiền & ngày) */
      partnerName: 'Người ấy',
      /* Cách chia tiền: "Mình trả" luôn có; hai cách sau là gợi ý cho người mới ({partner} = tên người chia cùng) */
      splitMe: 'Mình trả',
      splitHalf: 'Chia đều',
      splitPartner: 'Trả hộ',
      /* Tên khoản khi email ngân hàng không ghi nội dung giao dịch */
      unknownMerchant: 'Giao dịch',
    },
  },

  /* ============ VÍ CỦA BẠN: SỐ DƯ, TỔNG TÀI SẢN (màn chính) ============ */
  wallet: {
    title: 'Ví của bạn',
    // Khi chưa nhập số dư nguồn nào
    emptyText: 'Nhập số dư từng ví / tài khoản để biết mình đang có bao nhiêu.',
    enter: 'Nhập số dư',
    // Khi đã có số dư
    edit: 'Sửa số dư',
    total: 'Tổng tài sản',
    debt: 'nợ {amount}',
    notSet: 'chưa nhập',
    transfer: 'Chuyển tiền',
    // Bảng nhập số dư
    sheetTitle: 'Số dư hiện tại',
    sheetHint: 'Nhập số tiền đang có trong từng nguồn lúc này. Sau đó app tự cộng trừ theo các khoản bạn ghi.',
    balanceLabel: 'Đang có',
    debtLabel: 'Đang nợ',
    leaveEmpty: 'Để trống nếu không muốn theo dõi nguồn này',
    save: 'Lưu',
  },

  /* ============ KHOẢN ĐỊNH KỲ (Cài đặt → Khoản định kỳ) ============ */
  recurring: {
    // Dòng trong danh sách Cài đặt
    menuTitle: 'Khoản định kỳ',
    menuSub: '{n} khoản tự ghi mỗi tháng',
    menuEmpty: 'Tiền nhà, Netflix, lương… tự ghi mỗi tháng',
    // Danh sách
    hint: 'Tới ngày, app tự ghi vào Sổ chi (lúc bạn mở app).',
    empty: 'Chưa có khoản định kỳ nào',
    add: 'Thêm khoản định kỳ',
    rowMeta: 'Ngày {day} hằng tháng · lần tới {next}',
    paused: 'Đang tạm dừng',
    // Bảng thêm / sửa
    formNew: 'Khoản định kỳ mới',
    formEdit: 'Sửa khoản định kỳ',
    name: 'Tên',
    namePlaceholder: 'Tiền nhà, Netflix, Lương…',
    amount: 'Số tiền',
    kindExpense: 'Chi',
    kindIncome: 'Thu',
    category: 'Danh mục',
    account: 'Nguồn tiền',
    day: 'Ngày trong tháng',
    dayHint: 'Tháng nào ngắn hơn thì ghi vào ngày cuối tháng.',
    split: 'Cách chia',
    withWho: 'Với ai',
    pause: 'Tạm dừng',
    pauseHint: 'Không tự ghi nữa cho tới khi bật lại',
    save: 'Lưu',
    delete: 'Xóa',
    confirmDelete: 'Xóa khoản định kỳ "{name}"? Các khoản đã ghi trước đó vẫn giữ nguyên.',
  },

  /* ============ BÁO CÁO (màn chính → Chi tiêu → Báo cáo) ============ */
  report: {
    // Tiêu đề màn hình, nút điều hướng
    title: 'Báo cáo',

    // Thẻ tóm tắt kỳ hiện tại
    nowTitle: 'Tháng này (tạm tính)',
    spent: 'Tổng chi (cả cố định, trả góp)',
    income: 'Thu',
    saving: 'Để dành',
    overspent: 'Chi quá thu',
    savingRate: '{pct}% thu nhập',
    vsPrevMore: '+{pct}% so với tháng trước',
    vsPrevLess: '−{pct}% so với tháng trước',
    vsPrevSame: 'Ngang tháng trước',

    // Biểu đồ cột 6 tháng
    chartTitle: 'Chi 6 tháng gần đây',
    monthShort: 'T{m}',
    legendSpent: 'Chi',
    legendIncome: 'Thu',
    partial: 'đang chạy',
    chartAria: 'Biểu đồ chi và thu 6 tháng',
    barAria: '{month}: chi {spent}, thu {income}',

    // Điểm đáng chú ý
    insightsTitle: 'Điểm đáng chú ý',
    insightUp: '**{name}** tăng {pct}% so với trung bình {n} tháng trước',
    insightUpPrev: '**{name}** tăng {pct}% so với tháng trước',
    insightDown: '**{name}** giảm {pct}% so với trung bình {n} tháng trước',
    insightDownPrev: '**{name}** giảm {pct}% so với tháng trước',
    insightTop: 'Chi nhiều nhất: **{name}** ({amount}, {pct}%)',
    insightAvg: 'Trung bình {n} tháng trước chi **{amount}**/tháng',
    insightAvgPrev: 'Tháng trước chi **{amount}**',
    insightsNone: 'Chưa có gì đặc biệt, mọi thứ đều ổn.',

    // Xu hướng theo danh mục
    catTitle: 'Theo danh mục',
    catAvg: 'Trung bình {amount}/tháng',
    catAria: 'Biểu đồ chi {name} 6 tháng',
    otherCategory: 'Khác',

    // Chưa có dữ liệu
    emptyTitle: 'Chưa có gì để báo cáo',
    emptyText: 'Ghi vài khoản chi, báo cáo sẽ hiện ở đây.',
  },
  /* ============ KHI APP BỊ LỖI (thay cho màn trắng) ============ */
  crash: {
    title: 'Ví Gọn gặp lỗi',
    text: 'Dữ liệu của bạn vẫn an toàn. Thử tải lại; chưa được thì bấm Sửa lỗi để xoá bản cũ trong máy.',
    reload: 'Tải lại',
    fix: 'Sửa lỗi',
  },

  /* ============ MỤC TIÊU TIẾT KIỆM (màn chính → thẻ Mục tiêu) ============ */
  goals: {
    title: 'Mục tiêu tiết kiệm',
    tile: 'Mục tiêu',
    tileEmpty: 'Đặt mục tiêu',
    tileEmptySub: 'Du lịch, mua máy…',
    tileSub: '{pct}% · {name}',
    empty: 'Để dành cho chuyến đi, cái điện thoại mới… Đặt số tiền và hạn, app tính giúp mỗi tháng cần bỏ bao nhiêu.',
    add: 'Thêm mục tiêu',
    monthly: 'Mỗi tháng bỏ {amount} để kịp {date}',
    noDeadline: 'Còn thiếu {amount}',
    late: 'Đã qua hạn {date} · còn thiếu {amount}',
    done: 'Đã đủ 🎉',
    deposit: 'Bỏ thêm',
    withdraw: 'Rút ra',
    // Bảng thêm / sửa
    formNew: 'Mục tiêu mới',
    formEdit: 'Sửa mục tiêu',
    name: 'Tên',
    namePlaceholder: 'Đi Đà Lạt, iPhone mới, Quỹ khẩn cấp…',
    target: 'Số tiền cần',
    deadline: 'Hạn (không bắt buộc)',
    startSaved: 'Đã có sẵn',
    icon: 'Biểu tượng',
    save: 'Lưu',
    delete: 'Xóa mục tiêu',
    confirmDelete: 'Xóa mục tiêu "{name}"?',
    // Bảng bỏ thêm / rút ra
    depositTitle: 'Bỏ thêm vào "{name}"',
    withdrawTitle: 'Rút ra từ "{name}"',
    amount: 'Số tiền',
    depositHint: 'Chỉ ghi vào mục tiêu, không trừ số dư ví. Muốn trừ ví thì ghi thêm một khoản Chuyển sang tài khoản tiết kiệm.',
  },

  /* ============ VAY / CHO VAY (màn Chia tiền) ============ */
  loan: {
    lend: 'Cho vay',
    borrow: 'Đi vay',
    editLend: 'Khoản cho vay',
    editBorrow: 'Khoản đi vay',
    whoLend: 'Cho ai vay?',
    whoBorrow: 'Vay của ai?',
    newPerson: '+ Người khác',
    newPersonPrompt: 'Tên người',
    amount: 'Số tiền',
    account: 'Tiền ra từ',
    accountBorrow: 'Tiền vào',
    date: 'Ngày',
    note: 'Ghi chú',
    notePlaceholder: 'Mượn đóng học phí…',
    paidBack: 'Đã trả lại',
    save: 'Lưu',
    delete: 'Xóa',
    confirmDelete: 'Xóa khoản này?',
    // Tên hiện trong sổ chi
    lendMerchant: 'Cho {name} vay',
    borrowMerchant: 'Vay {name}',
    lendMeta: 'Cho vay · còn {amount}',
    borrowMeta: 'Đi vay · còn nợ {amount}',
    loanDone: 'Đã trả xong',
    // Màn Chia tiền
    youOwe: 'Bạn đang nợ',
    owedLine: '{date} · vay {amount}',
    hint: 'Cho vay / đi vay không tính là chi tiêu, chỉ cộng trừ vào số dư ví.',
    fromTransfer: 'Cho ai vay / vay của ai? Ghi ở đây →',
    tileOwe: 'Bạn đang nợ',
    tileOweSub: '{n} người',
    tileEmpty: 'Nợ & cho vay',
    tileEmptySub: 'Bấm để ghi cho mượn / đi mượn',
  },

  /* ============ KHOÁ APP (Cài đặt → Khoá app) ============ */
  lock: {
    menu: 'Khoá app',
    menuOn: 'Đang bật',
    menuOff: 'Vân tay, Face ID hoặc mã PIN',
    title: 'Ví Gọn đang khoá',
    enterPin: 'Nhập mã PIN',
    wrongPin: 'Sai mã, thử lại',
    useBio: 'Dùng vân tay / Face ID',
    enable: 'Khoá app',
    enableSub: 'Mở app, hoặc quay lại sau 1 phút, thì phải mở khoá',
    setPin: 'Đặt mã PIN (4–6 số)',
    confirmPin: 'Nhập lại mã PIN',
    pinMismatch: 'Hai mã không giống nhau',
    pinShort: 'Mã PIN cần 4–6 số',
    savePin: 'Lưu mã PIN',
    changePin: 'Đổi mã PIN',
    bio: 'Mở bằng vân tay / Face ID',
    bioSub: 'Vân tay lỗi thì vẫn mở được bằng mã PIN',
    bioUnavailable: 'Máy / trình duyệt này chưa cho app web dùng vân tay / Face ID. Vẫn khoá được bằng mã PIN.',
    bioFailed: 'Không bật được vân tay / Face ID',
    forgot: 'Quên mã PIN?',
    forgotConfirm: 'Quên mã PIN thì chỉ còn cách xoá dữ liệu trên máy này rồi khôi phục lại từ Google Drive hoặc file sao lưu. Xoá?',
    note: 'Khoá app để người khác cầm máy không xem được. Khoá chỉ áp dụng trên máy này.',
    bioUser: 'Ví Gọn',
  },

  /* ============ NHẮC NHỞ / THÔNG BÁO (Cài đặt → Nhắc nhở) ============ */
  remind: {
    menu: 'Nhắc nhở',
    menuOff: 'Nhắc ghi chi tiêu, hạn trả thẻ',
    menuOn: '{n} nhắc nhở đang bật',
    permTitle: 'Thông báo',
    permAsk: 'Cho phép thông báo',
    permOn: 'Đã cho phép thông báo',
    permDenied: 'Thông báo đang bị chặn. Vào cài đặt điện thoại / trình duyệt → Ví Gọn → cho phép Thông báo.',
    permUnsupported: 'Trình duyệt này không gửi thông báo được. Bạn vẫn thấy lời nhắc ngay trong app.',
    iosHint: 'iPhone: phải **Thêm vào MH chính** (nút Chia sẻ → Thêm vào MH chính) rồi mở app từ biểu tượng đó mới bật được thông báo.',
    daily: 'Nhắc ghi chi tiêu',
    dailySub: 'Hôm nào chưa ghi khoản nào thì nhắc',
    dailyAt: 'Lúc',
    hour: '{h}:00',
    card: 'Nhắc hạn trả thẻ',
    cardSub: 'Trước hạn',
    cardDays: '{n} ngày',
    budget: 'Báo sắp lố ngân sách',
    budgetSub: 'Khi một danh mục đã tiêu tới',
    test: 'Thử thông báo',
    howTitle: 'Khi nào thì nhắc?',
    how: 'Mở app là app kiểm tra và nhắc ngay. Lúc app đang đóng: **Android** đã cài app ra màn hình chính thì vẫn nhắc, nhưng giờ có thể lệch vì máy tự chọn lúc chạy ngầm. **iPhone** chỉ nhắc khi mở app.',
    // Nội dung thông báo
    dailyTitle: 'Hôm nay tiêu gì chưa ghi? ✍️',
    dailyBody: 'Bấm để ghi nhanh, 5 giây thôi.',
    cardTitle: 'Sắp tới hạn trả thẻ',
    cardBody: 'Còn {n} ngày (hạn {date}) · cần trả {amount}',
    cardToday: 'Hôm nay là hạn trả thẻ · cần trả {amount}',
    budgetTitle: 'Sắp lố ngân sách',
    budgetBody: '{name} đã tiêu {pct}% ({spent} / {limit})',
    budgetOverTitle: 'Lố ngân sách rồi',
    budgetOverBody: '{name} đã vượt {amount}',
    testTitle: 'Ví Gọn',
    testBody: 'Thông báo hoạt động rồi 👍',
    // Lời nhắc trong app (màn chính)
    bannerDaily: 'Hôm nay chưa ghi khoản nào',
    bannerAdd: 'Ghi ngay',
  },

  /* ============ NHẬP TỪ APP KHÁC (Cài đặt → Sao lưu & dữ liệu) ============ */
  migrate: {
    title: 'Nhập từ app khác',
    hint: 'Chuyển lịch sử từ Money Lover, Misa Sổ Thu Chi, hoặc file Excel / CSV sao kê ngân hàng.',
    pick: 'Chọn file',
    how: 'Money Lover: Cài đặt → Xuất dữ liệu (CSV / Excel). Misa: Báo cáo → Xuất Excel. Chưa rõ thì cứ chọn file, app tự dò cột.',
    readFail: 'Không đọc được file này. Thử xuất lại dạng .csv hoặc .xlsx.',
    sheetTitle: 'Nhập từ file',
    colsTitle: 'Cột trong file',
    colsHint: 'App đã tự dò. Sai cột nào thì chọn lại.',
    colNone: '— không có —',
    cols: {
      date: 'Ngày',
      amount: 'Số tiền',
      income: 'Tiền thu',
      expense: 'Tiền chi',
      type: 'Loại (thu / chi)',
      category: 'Danh mục',
      note: 'Ghi chú',
      account: 'Ví / tài khoản',
    },
    summary: '**{n}** khoản · chi {spent} · thu {earned}',
    range: 'Từ {from} đến {to}',
    newCats: 'Danh mục mới: {names}',
    newAccounts: 'Nguồn tiền mới: {names}',
    skipped: 'Bỏ qua {n} dòng không có ngày / số tiền',
    transfers: 'Bỏ qua {n} khoản chuyển tiền / vay nợ',
    duplicates: 'Bỏ qua {n} khoản đã nhập lần trước',
    account: 'Dòng không ghi ví thì cho vào',
    nothing: 'Không thấy khoản nào để nhập. Kiểm tra lại cột Ngày và Số tiền.',
    import: 'Nhập {n} khoản',
    done: 'Đã nhập {n} khoản.',
  },
  /* ============ ẨN SỐ TIỀN (nút con mắt góc trên) ============ */
  privacy: {
    hide: 'Ẩn số tiền',
    show: 'Hiện số tiền',
    mask: '•••••',
  },

  /* ============ ĐỐI CHIẾU SAO KÊ (tab Thẻ) ============ */
  reconcile: {
    button: 'Đối chiếu sao kê',
    title: 'Đối chiếu sao kê',
    hint: 'Chọn file sao kê PDF (hoặc ảnh chụp) của thẻ này. App so với các khoản bạn đã ghi và chỉ ra chỗ thiếu, chỗ trùng.',
    pick: 'Chọn file sao kê',
    reading: 'Đang đọc sao kê…',
    needAi: 'Sao kê dạng ảnh cần AI để đọc. Vào Cài đặt → AI nhập tự động để nhập key.',
    nothing: 'Không đọc được dòng giao dịch nào trong file này.',
    summary: 'Sao kê **{n}** dòng · khớp **{ok}**',
    allGood: 'Khớp hết rồi 🎉 Không thiếu, không trùng.',
    missingTitle: 'Chưa ghi ({n})',
    missingHint: 'Sao kê có mà app chưa có.',
    add: 'Thêm',
    addAll: 'Thêm tất cả ({n})',
    added: 'Đã thêm',
    mismatchTitle: 'Lệch số tiền ({n})',
    mismatchLine: 'App ghi {app} · sao kê {bank}',
    fixAmount: 'Sửa thành {amount}',
    fixed: 'Đã sửa',
    extraTitle: 'Có trong app, không có trên sao kê ({n})',
    extraHint: 'Có thể ghi trùng, ghi nhầm thẻ, hoặc ngân hàng chưa ghi nhận. Chạm để sửa / xoá.',
    dup: 'nghi ghi trùng',
    again: 'Chọn file khác',
  },

  /* ============ KHOẢN LẠ (màn chính) ============ */
  odd: {
    title: 'Cần xem lại',
    duplicate: 'Ghi 2 lần? Giống khoản ngày {date}',
    twice: 'Tháng này bị trừ 2 lần (thường mỗi tháng 1 lần)',
    big: 'Gấp {n} lần mức thường của {category}',
    cardPay: 'Trả thẻ mà ghi là Chi → bị tính tiêu 2 lần. Bấm vào, đổi sang Chuyển',
    installment: 'Trả góp app đã tự cộng mỗi tháng → khoản này bị tính 2 lần. Bấm vào để xoá',
    loan: 'Cho mượn / trả nợ mà ghi là Chi → bị tính là tiêu. Nên ghi ở ô Nợ & cho vay',
    dismiss: 'Bỏ qua',
  },

  /* ============ GỢI Ý NGÂN SÁCH (Ngân sách → Lập ngân sách) ============ */
  suggest: {
    title: 'Gợi ý từ tiền thu',
    needIncome: 'Nhập tiền thu tháng này ở trên, app sẽ chia giúp.',
    savePct: 'Để dành',
    income: 'Tiền thu',
    fixed: 'Khoản cố định',
    installments: 'Trả góp',
    saving: 'Để dành',
    savingGoals: 'Để dành (đủ cho mục tiêu {amount}/tháng)',
    flexible: 'Còn chi linh hoạt',
    byHabit: 'Chia cho các mục theo thói quen chi các tháng trước.',
    even: 'Chưa có lịch sử chi nên chia đều cho các mục.',
    short: 'Tiền thu không đủ cho cố định + trả góp + để dành. Giảm % để dành hoặc xem lại khoản cố định.',
    apply: 'Điền vào ngân sách',
    applied: 'Đã điền. Sửa lại từng mục tùy ý rồi bấm Lưu.',
  },

  /* ============ TỔNG KẾT THÁNG ============ */
  recap: {
    banner: 'Tổng kết {month} đã có ✨',
    button: 'Tổng kết tháng',
    title: 'Tổng kết {month}',
    spent: 'Bạn đã tiêu',
    vsMore: 'nhiều hơn tháng trước {pct}%',
    vsLess: 'ít hơn tháng trước {pct}%',
    vsSame: 'ngang tháng trước',
    income: 'Thu',
    saving: 'Để dành',
    overspent: 'Chi quá thu',
    topTitle: 'Tiêu nhiều nhất',
    statsTitle: 'Vài con số',
    count: '**{n}** khoản chi',
    noSpend: '**{n}/{total}** ngày không tiêu đồng nào',
    biggest: 'Khoản lớn nhất: **{name}** {amount}',
    budgetKept: 'Giữ được ngân sách **{kept}/{total}** mục',
    goals: 'Bỏ vào mục tiêu **{amount}**',
    prev: 'Tháng trước',
    next: 'Tháng sau',
    empty: 'Tháng này chưa có khoản chi nào.',
  },

  /* ============ LỊCH TIỀN ============ */
  calendar: {
    title: 'Lịch tiền',
    tile: 'Sắp tới',
    tileEmpty: 'Lịch tiền',
    tileEmptySub: 'Lương, hạn thẻ, khoản định kỳ',
    tileSub: '{date} · {name}',
    salary: 'Nhận lương',
    card: 'Hạn trả thẻ',
    weekdays: 'T2,T3,T4,T5,T6,T7,CN',
    listTitle: 'Trong tháng',
    empty: 'Tháng này chưa có mốc nào. Thêm khoản định kỳ (tiền nhà, Netflix…) để thấy ở đây.',
    today: 'Hôm nay',
    totalOut: 'Phải chi',
    totalIn: 'Sẽ nhận',
  },
};
