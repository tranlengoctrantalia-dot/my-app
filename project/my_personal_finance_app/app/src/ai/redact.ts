/**
 * Che thông tin cá nhân trong chữ (email, sao kê) trước khi gửi cho AI.
 * AI chỉ cần ngày, nơi chi, số tiền — không cần biết bạn là ai.
 */

/** Bỏ dấu tiếng Việt để so khớp tên viết có dấu / không dấu / hoa thường. */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

// \b của JavaScript không hiểu chữ có dấu (Đ, ơ…), nên tự kiểm tra ranh giới chữ bằng \p{L}.
const LABELS =
  /^(.*?(?<![\p{L}\d])(?:họ và tên|họ tên|tên khách hàng|khách hàng|quý khách(?: hàng)?|chủ thẻ|địa chỉ|address|customer(?: name)?|cardholder|cmnd|cccd|căn cước|ngày sinh|date of birth|số điện thoại|điện thoại|phone|mobile)(?![\p{L}\d])\s*[:：]?)\s*(.+)$/gimu;

export function redact(text: string, privateWords: string[] = []): string {
  let out = text
    // email
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]')
    // số điện thoại Việt Nam
    .replace(/(?<![\d.,])(?:\+?84|0)(?:[\s.-]?\d){9,10}(?![\d.,])/g, '[sđt]')
    // số thẻ: 12–19 chữ số, có thể bị che một phần bằng x / * và cách nhau bằng khoảng trắng / gạch
    .replace(/(?<![\d.,])(?:[\dXx*][ -]?){11,18}[\dXx*](?![\d.,])/g, (m) => ((m.match(/\d/g) ?? []).length >= 4 ? '[số thẻ]' : m))
    // số tài khoản, CCCD: dãy liền từ 9 chữ số trở lên (số tiền thường có dấu chấm ngăn cách)
    .replace(/(?<![\d.,])\d{9,}(?![\d.,])/g, '[số TK]')
    // dòng có nhãn thông tin cá nhân: giữ nhãn, che phần sau
    .replace(LABELS, '$1 [đã che]');

  // tên riêng người dùng khai báo (so khớp cả không dấu, hoa thường)
  for (const w of privateWords.map((x) => x.trim()).filter((x) => x.length >= 2)) {
    const target = fold(w);
    const folded = fold(out);
    let result = '';
    let i = 0;
    for (let idx = folded.indexOf(target); idx !== -1; idx = folded.indexOf(target, i)) {
      result += out.slice(i, idx) + '[tên]';
      i = idx + target.length;
    }
    out = result + out.slice(i);
  }
  return out;
}
