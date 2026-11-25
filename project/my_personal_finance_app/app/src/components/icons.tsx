/** Icon Material Symbols (Google, Apache-2.0) — kiểu Rounded, tô đặc. */
import type { SVGProps } from 'react';
import type { Category } from '../domain/types';
import { useStore } from '../store';

// Nạp toàn bộ file SVG cần dùng lúc build (Vite gộp vào bundle, không tải thêm khi chạy).
const files = import.meta.glob(
  [
    '/node_modules/@material-symbols/svg-400/rounded/{home,receipt_long,pie_chart,credit_card,settings,shopping_bag,local_cafe,favorite,two_wheeler,redeem,spa,sell,groups,fitness_center,savings,volunteer_activism,mobile,calendar_today,person,cloud,payments,light_mode,dark_mode,bolt,medication,movie,school,pets,celebration,work,restaurant,checkroom,face,flight,directions_car,sports_esports,child_care,photo_camera,mail,edit,delete,add_circle,account_balance,account_balance_wallet,fastfood,local_mall,home_repair_service,wifi,local_gas_station,trending_up,document_scanner,shopping_cart,grocery,star,palette,help,mic,group_add,link,logout,swap_horiz,handshake,lock,fingerprint,notifications,flag,upload_file,call_made,call_received,backspace,beach_access,devices,flight_takeoff,laptop_mac,diamond,emergency,visibility,visibility_off,calendar_month,fact_check,warning}-fill.svg',
    '/node_modules/@material-symbols/svg-400/rounded/{add,chevron_left,chevron_right,search,close,undo,check,content_copy,info}.svg',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const paths: Record<string, string[]> = {};
for (const [file, svg] of Object.entries(files)) {
  const name = file.split('/').pop()!.replace(/(-fill)?\.svg$/, '');
  paths[name] = [...svg.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);
}

/** Tên gọn dùng trong code → tên Material Symbols. */
const alias: Record<string, string> = {
  receipt: 'receipt_long',
  target: 'pie_chart',
  card: 'credit_card',
  plus: 'add',
  bag: 'shopping_bag',
  coffee: 'local_cafe',
  heart: 'favorite',
  bike: 'two_wheeler',
  gift: 'redeem',
  sparkle: 'spa',
  tag: 'sell',
  users: 'groups',
  dumbbell: 'fitness_center',
  wallet: 'savings',
  care: 'volunteer_activism',
  phone: 'mobile',
  left: 'chevron_left',
  right: 'chevron_right',
  x: 'close',
  calendar: 'calendar_today',
  user: 'person',
  money: 'payments',
  sun: 'light_mode',
  moon: 'dark_mode',
  scan: 'document_scanner',
  camera: 'photo_camera',
  bank: 'account_balance',
  ewallet: 'account_balance_wallet',
};

export type IconName = string;

export function Icon({ name, size = 22, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  const d = paths[alias[name] ?? name] ?? paths.sell;
  return (
    <svg width={size} height={size} viewBox="0 -960 960 960" fill="currentColor" aria-hidden {...rest}>
      {d.map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}

/** Icon 3D (Fluent Emoji, MIT) trong public/emoji; tên trùng với tên icon ở trên. */
const art3d = new Set(
  'bag bank bike bolt bullseye calendar calendar_month card care cash celebration check checkroom child_care cloud coffee directions_car dumbbell ewallet face fact_check fastfood flag flight gift grocery handshake heart help home_repair_service local_gas_station lock medication money movie notepad notifications palette pets phone receipt restaurant scan school shopping_cart sparkle sports_esports star tag target trending_up user users wallet warning wifi work'.split(' '),
);

/** Icon nhiều màu; tên chưa có bản 3D thì dùng icon thường. */
export function Art({ name, size = 28 }: { name: IconName; size?: number }) {
  if (!art3d.has(name)) return <Icon name={name} size={size} />;
  return <img className="art" src={`/emoji/${name}.webp`} width={size} height={size} alt="" loading="lazy" />;
}

/** Các icon cho người dùng chọn khi tạo danh mục. */
export const pickableIcons = [
  'bag', 'shopping_cart', 'checkroom', 'face', 'sparkle', 'coffee', 'restaurant', 'fastfood',
  'grocery', 'heart', 'movie', 'sports_esports', 'bike', 'directions_car', 'local_gas_station', 'flight',
  'bolt', 'wifi', 'phone', 'home_repair_service', 'medication', 'dumbbell', 'school', 'child_care',
  'pets', 'gift', 'care', 'users', 'wallet', 'money', 'work', 'celebration',
  'trending_up', 'star', 'tag',
];

export const palette = ['#f06292', '#e57373', '#ffb74d', '#ffcc80', '#aed581', '#81c784', '#4dd0e1', '#64b5f6', '#ba68c8', '#f48fb1', '#90a4ae'];

const catIcons: Record<string, IconName> = {
  shopping: 'bag',
  food: 'coffee',
  dating: 'heart',
  transport: 'bike',
  gift: 'gift',
  beauty: 'sparkle',
  other: 'tag',
  family: 'care',
  gym: 'dumbbell',
  fund: 'users',
  saving: 'wallet',
  bills: 'bolt',
  health: 'medication',
  fun: 'movie',
  salary: 'money',
  bonus: 'celebration',
  'gift-in': 'gift',
  'other-in': 'trending_up',
};

const catColors: Record<string, string> = {
  shopping: '#f06292',
  food: '#ffb74d',
  dating: '#e57373',
  transport: '#64b5f6',
  gift: '#ba68c8',
  beauty: '#f48fb1',
  other: '#90a4ae',
  family: '#ffcc80',
  gym: '#4dd0e1',
  fund: '#81c784',
  saving: '#aed581',
  bills: '#ffcc80',
  health: '#4dd0e1',
  fun: '#ba68c8',
  salary: '#81c784',
  bonus: '#ffb74d',
  'gift-in': '#f06292',
  'other-in': '#64b5f6',
};

export const catIcon = (id: string, c?: Category): IconName =>
  c?.iconName ?? catIcons[id] ?? (id.startsWith('inst') ? 'phone' : 'tag');

export function catColor(id: string, c?: Category): string {
  if (c?.color) return c.color;
  if (catColors[id]) return catColors[id];
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

/** Ô icon tròn có nền nhạt theo màu danh mục. */
export function CatBadge({ id, size = 40 }: { id: string; size?: number }) {
  const { data } = useStore();
  const c = data.categories.find((x) => x.id === id);
  const color = catColor(id, c);
  return (
    <span className="cat-badge" style={{ width: size, height: size, color, background: `${color}26` }}>
      <Art name={catIcon(id, c)} size={Math.round(size * 0.68)} />
    </span>
  );
}
