import type {
  CourtServiceCategory,
  CourtServiceOption,
  PublishedListing,
} from '../types/marketplace';

export const COURT_SERVICE_CATEGORY_LABELS: Record<CourtServiceCategory | 'ALL', string> = {
  ALL: 'Tất cả dịch vụ',
  DRINKS: 'Nước & Điện giải',
  EQUIPMENT: 'Dụng cụ thi đấu',
  SUPPORT: 'Hỗ trợ trận đấu',
  FACILITY: 'Tiện ích & Hậu cần',
};

export const PRESET_SERVICE_IMAGES: { label: string; url: string }[] = [
  { label: 'Nước suối & Điện giải', url: '/images/services/service-water-drinks.jpg' },
  { label: 'Bình trà lạnh & Khăn mát', url: '/images/services/service-iced-tea.jpg' },
  { label: 'Bóng đá thi đấu', url: '/images/services/service-soccer-ball.jpg' },
  { label: 'Áo bib phân đội', url: '/images/services/service-football-bibs.jpg' },
  { label: 'Găng tay thủ môn', url: '/images/services/service-gk-gloves.jpg' },
  { label: 'Trọng tài điều hành', url: '/images/services/service-referee.jpg' },
  { label: 'Camera Highlight AI', url: '/images/services/service-camera-ai.jpg' },
  { label: 'Vợt & Bóng Pickleball', url: '/images/services/service-pickleball-paddle.jpg' },
  { label: 'Ống cầu & Vợt Cầu lông', url: '/images/services/service-badminton-shuttle.jpg' },
  { label: 'Giày thể thao sân trong nhà', url: '/images/services/service-badminton-shoes.jpg' },
  { label: 'Bóng & Vợt Tennis', url: '/images/services/service-tennis-balls.jpg' },
  { label: 'Bóng rổ da tiêu chuẩn', url: '/images/services/service-basketball-ball.jpg' },
  { label: 'Bảng điểm điện tử 24s', url: '/images/services/service-scoreboard.jpg' },
  { label: 'HLV & Bạn tập', url: '/images/services/service-coach.jpg' },
  { label: 'Khăn tắm & Tủ Locker', url: '/images/services/service-locker-towel.jpg' },
  { label: 'Đá chườm & Sơ cứu', url: '/images/services/service-recovery-ice.jpg' },
];

/**
 * Industry reference templates shown ONLY inside the Lessor Internal Portal as optional 1-click suggestions.
 * Courts NEVER automatically display these unless the Lessor explicitly adds them to a court group.
 */
const SUGGESTED_TEMPLATES_BY_SPORT: Record<string, CourtServiceOption[]> = {
  FOOTBALL: [
    {
      id: 'tpl-fb-water-case',
      sportCode: 'FOOTBALL',
      category: 'DRINKS',
      name: 'Thùng nước suối ướp lạnh (24 chai)',
      description: 'Ướp đá sẵn giao tận đường biên trước giờ bóng lăn cho đội 7v7.',
      unitLabel: 'thùng',
      unitPrice: 120_000,
      maxQty: 5,
      imageUrl: '/images/services/service-water-drinks.jpg',
      popular: true,
      enabled: true,
    },
    {
      id: 'tpl-fb-isotonic-pack',
      sportCode: 'FOOTBALL',
      category: 'DRINKS',
      name: 'Lốc nước điện giải Revive / Pocari (12 chai)',
      description: 'Bù khoáng nhanh giữa hiệp, giữ lạnh trong thùng giữ nhiệt.',
      unitLabel: 'lốc',
      unitPrice: 145_000,
      maxQty: 5,
      imageUrl: '/images/services/service-water-drinks.jpg',
      popular: true,
      enabled: true,
    },
    {
      id: 'tpl-fb-iced-tea-jug',
      sportCode: 'FOOTBALL',
      category: 'DRINKS',
      name: 'Bình trà đá lớn 20L + Ly dùng 1 lần',
      description: 'Phù hợp kèo giao hữu đông người, miễn phí châm thêm đá.',
      unitLabel: 'bình',
      unitPrice: 40_000,
      maxQty: 4,
      imageUrl: '/images/services/service-iced-tea.jpg',
      enabled: true,
    },
    {
      id: 'tpl-fb-match-ball',
      sportCode: 'FOOTBALL',
      category: 'EQUIPMENT',
      name: 'Thuê bóng thi đấu Molten / Động Lực',
      description: 'Bóng da bơm chuẩn áp suất sân cỏ nhân tạo 7v7.',
      unitLabel: 'quả',
      unitPrice: 30_000,
      maxQty: 4,
      imageUrl: '/images/services/service-soccer-ball.jpg',
      enabled: true,
    },
    {
      id: 'tpl-fb-bibs-set',
      sportCode: 'FOOTBALL',
      category: 'EQUIPMENT',
      name: 'Bộ áo bib phân đội (7 áo sạch khử khuẩn)',
      description: 'Đủ màu neon/cam nổi bật dưới đèn pha buổi tối.',
      unitLabel: 'bộ',
      unitPrice: 35_000,
      maxQty: 4,
      imageUrl: '/images/services/service-football-bibs.jpg',
      enabled: true,
    },
    {
      id: 'tpl-fb-gk-gloves',
      sportCode: 'FOOTBALL',
      category: 'EQUIPMENT',
      name: 'Thuê găng tay thủ môn chuyên dụng',
      description: 'Mút bám tốt cho sân cỏ nhân tạo, vệ sinh sau mỗi ca.',
      unitLabel: 'đôi',
      unitPrice: 40_000,
      maxQty: 4,
      imageUrl: '/images/services/service-gk-gloves.jpg',
      enabled: true,
    },
    {
      id: 'tpl-fb-referee',
      sportCode: 'FOOTBALL',
      category: 'SUPPORT',
      name: 'Thuê Trọng tài điều hành trận (1 ca)',
      description: 'Trọng tài có kinh nghiệm bắt giải phủi, còi & thẻ chuyên nghiệp.',
      unitLabel: 'ca',
      unitPrice: 250_000,
      maxQty: 1,
      imageUrl: '/images/services/service-referee.jpg',
      popular: true,
      enabled: true,
    },
    {
      id: 'tpl-fb-highlight-cam',
      sportCode: 'FOOTBALL',
      category: 'SUPPORT',
      name: 'Quay Highlight bàn thắng Camera AI góc cao',
      description: 'Trả link video Full HD toàn trận + cắt clip bàn thắng sau 30 phút.',
      unitLabel: 'trận',
      unitPrice: 120_000,
      maxQty: 1,
      imageUrl: '/images/services/service-camera-ai.jpg',
      enabled: true,
    },
    {
      id: 'tpl-fb-cold-spray',
      sportCode: 'FOOTBALL',
      category: 'FACILITY',
      name: 'Gói đá chườm cơ + Chai xịt lạnh thể thao',
      description: 'Hỗ trợ sơ cứu căng cơ, va chạm nhẹ ngay tại khu kỹ thuật.',
      unitLabel: 'gói',
      unitPrice: 45_000,
      maxQty: 4,
      imageUrl: '/images/services/service-recovery-ice.jpg',
      enabled: true,
    },
  ],

  PICKLEBALL: [
    {
      id: 'tpl-pb-isotonic-bottle',
      sportCode: 'PICKLEBALL',
      category: 'DRINKS',
      name: 'Nước điện giải Pocari / Aquarius ướp lạnh',
      description: 'Giao tận ghế chờ mặt sân, giữ lạnh suốt ca thi đấu.',
      unitLabel: 'chai',
      unitPrice: 18_000,
      maxQty: 12,
      imageUrl: '/images/services/service-water-drinks.jpg',
      popular: true,
      enabled: true,
    },
    {
      id: 'tpl-pb-drink-towel-combo',
      sportCode: 'PICKLEBALL',
      category: 'DRINKS',
      name: 'Combo 4 chai nước khoáng + 4 khăn lạnh',
      description: 'Combo tiết kiệm chuẩn cho nhóm đánh đôi 4 người.',
      unitLabel: 'combo',
      unitPrice: 55_000,
      maxQty: 6,
      imageUrl: '/images/services/service-iced-tea.jpg',
      popular: true,
      enabled: true,
    },
    {
      id: 'tpl-pb-paddle-carbon',
      sportCode: 'PICKLEBALL',
      category: 'EQUIPMENT',
      name: 'Thuê vợt Carbon T700 tiêu chuẩn USAPA',
      description: 'Mặt nhám tạo xoáy tốt, trọng lượng cân bằng cho mọi trình độ.',
      unitLabel: 'cây',
      unitPrice: 50_000,
      maxQty: 8,
      imageUrl: '/images/services/service-pickleball-paddle.jpg',
      popular: true,
      enabled: true,
    },
    {
      id: 'tpl-pb-paddle-pro',
      sportCode: 'PICKLEBALL',
      category: 'EQUIPMENT',
      name: 'Thuê vợt Pro Joola / Selkirk cao cấp',
      description: 'Dòng vợt lõi tổ ong 16mm dành cho người chơi nâng cao.',
      unitLabel: 'cây',
      unitPrice: 90_000,
      maxQty: 4,
      imageUrl: '/images/services/service-pickleball-paddle.jpg',
      enabled: true,
    },
    {
      id: 'tpl-pb-balls-pack',
      sportCode: 'PICKLEBALL',
      category: 'EQUIPMENT',
      name: 'Bóng thi đấu Franklin X-40 (Hộp 3 quả)',
      description: 'Bóng mới nguyên hộp chuẩn 40 lỗ ngoài trời / mái vòm.',
      unitLabel: 'hộp',
      unitPrice: 85_000,
      maxQty: 5,
      imageUrl: '/images/real-pickleball-net.jpg',
      enabled: true,
    },
    {
      id: 'tpl-pb-coach-hour',
      sportCode: 'PICKLEBALL',
      category: 'SUPPORT',
      name: 'HLV hướng dẫn kỹ thuật & ghép trận',
      description: 'Kèm kỹ thuật dink, drop shot và luật chấm điểm cơ bản – nâng cao.',
      unitLabel: 'giờ',
      unitPrice: 350_000,
      maxQty: 2,
      imageUrl: '/images/services/service-coach.jpg',
      enabled: true,
    },
    {
      id: 'tpl-pb-locker-towel',
      sportCode: 'PICKLEBALL',
      category: 'FACILITY',
      name: 'Khăn tắm bông + Tủ Locker VIP khóa thẻ',
      description: 'Sử dụng phòng tắm nóng lạnh và tủ đồ cá nhân an toàn.',
      unitLabel: 'lượt',
      unitPrice: 25_000,
      maxQty: 8,
      imageUrl: '/images/services/service-locker-towel.jpg',
      enabled: true,
    },
  ],

  BADMINTON: [
    {
      id: 'tpl-bm-isotonic-bottle',
      sportCode: 'BADMINTON',
      category: 'DRINKS',
      name: 'Nước khoáng / Điện giải ướp lạnh tại sân',
      description: 'Đặt sẵn trên khay ghế chờ của sân đã đặt.',
      unitLabel: 'chai',
      unitPrice: 15_000,
      maxQty: 12,
      imageUrl: '/images/services/service-water-drinks.jpg',
      popular: true,
      enabled: true,
    },
    {
      id: 'tpl-bm-lemon-salt-jug',
      sportCode: 'BADMINTON',
      category: 'DRINKS',
      name: 'Bình chanh muối giải nhiệt (2 lít)',
      description: 'Pha mới mỗi ca, bổ sung vitamin C và muối khoáng cho nhóm 4–6 người.',
      unitLabel: 'bình',
      unitPrice: 45_000,
      maxQty: 4,
      imageUrl: '/images/services/service-iced-tea.jpg',
      enabled: true,
    },
    {
      id: 'tpl-bm-shuttle-tc',
      sportCode: 'BADMINTON',
      category: 'EQUIPMENT',
      name: 'Ống cầu lông Thành Công / Hải Yến (12 quả)',
      description: 'Cầu lông vũ tự nhiên đi đầm, độ bền cao cho đánh phong trào.',
      unitLabel: 'ống',
      unitPrice: 235_000,
      maxQty: 5,
      imageUrl: '/images/services/service-badminton-shuttle.jpg',
      popular: true,
      enabled: true,
    },
    {
      id: 'tpl-bm-shuttle-yonex',
      sportCode: 'BADMINTON',
      category: 'EQUIPMENT',
      name: 'Ống cầu thi đấu Yonex AS-30 (12 quả)',
      description: 'Chuẩn giải đấu BWF, quỹ đạo bay ổn định tuyệt đối.',
      unitLabel: 'ống',
      unitPrice: 490_000,
      maxQty: 3,
      imageUrl: '/images/services/service-badminton-shuttle.jpg',
      enabled: true,
    },
    {
      id: 'tpl-bm-racket-rent',
      sportCode: 'BADMINTON',
      category: 'EQUIPMENT',
      name: 'Thuê vợt cầu lông Yonex / Lining Carbon',
      description: 'Căng sẵn 10.5kg dễ thuần, phù hợp người chơi quên mang vợt.',
      unitLabel: 'cây',
      unitPrice: 45_000,
      maxQty: 6,
      imageUrl: '/images/real-badminton-court-2.jpg',
      enabled: true,
    },
    {
      id: 'tpl-bm-restring',
      sportCode: 'BADMINTON',
      category: 'SUPPORT',
      name: 'Căng cước điện tử lấy nhanh (BG65/BG80)',
      description: 'Máy căng điện tử chuẩn số ký, nhận vợt trong ca đánh.',
      unitLabel: 'cây',
      unitPrice: 160_000,
      maxQty: 3,
      imageUrl: '/images/real-badminton-indoor.jpg',
      enabled: true,
    },
    {
      id: 'tpl-bm-shoes-rent',
      sportCode: 'BADMINTON',
      category: 'FACILITY',
      name: 'Thuê giày cầu lông đế kếp không bám sân',
      description: 'Đủ size 36–44 đã khử khuẩn UV, bảo vệ cổ chân trên thảm PVC.',
      unitLabel: 'đôi',
      unitPrice: 50_000,
      maxQty: 4,
      imageUrl: '/images/services/service-badminton-shoes.jpg',
      enabled: true,
    },
  ],

  TENNIS: [
    {
      id: 'tpl-tn-isotonic',
      sportCode: 'TENNIS',
      category: 'DRINKS',
      name: 'Nước điện giải Gatorade / Pocari ướp lạnh',
      description: 'Bổ sung năng lượng cho các set đấu kéo dài ngoài trời.',
      unitLabel: 'chai',
      unitPrice: 20_000,
      maxQty: 10,
      imageUrl: '/images/services/service-water-drinks.jpg',
      popular: true,
      enabled: true,
    },
    {
      id: 'tpl-tn-balls-can',
      sportCode: 'TENNIS',
      category: 'EQUIPMENT',
      name: 'Hộp bóng Tennis Wilson US Open (3 quả)',
      description: 'Bóng mới khui nắp áp suất cao, độ nảy chuẩn mặt sân Acrylic.',
      unitLabel: 'hộp',
      unitPrice: 135_000,
      maxQty: 5,
      imageUrl: '/images/services/service-tennis-balls.jpg',
      popular: true,
      enabled: true,
    },
    {
      id: 'tpl-tn-ball-machine',
      sportCode: 'TENNIS',
      category: 'EQUIPMENT',
      name: 'Thuê máy bắn bóng tự động + Rổ 60 bóng',
      description: 'Điều chỉnh tốc độ & độ xoáy qua remote, tập đều tay hiệu quả.',
      unitLabel: 'giờ',
      unitPrice: 180_000,
      maxQty: 1,
      imageUrl: '/images/court-tennis-pro.jpg',
      popular: true,
      enabled: true,
    },
    {
      id: 'tpl-tn-ballboy',
      sportCode: 'TENNIS',
      category: 'SUPPORT',
      name: 'Nhân viên nhặt bóng chuyên nghiệp (Ball Boy)',
      description: 'Phục vụ suốt ca đấu để giữ nhịp độ trận liên tục.',
      unitLabel: 'ca',
      unitPrice: 150_000,
      maxQty: 2,
      imageUrl: '/images/services/service-coach.jpg',
      enabled: true,
    },
  ],

  BASKETBALL: [
    {
      id: 'tpl-bk-isotonic-pack',
      sportCode: 'BASKETBALL',
      category: 'DRINKS',
      name: 'Lốc 12 chai nước điện giải ướp lạnh',
      description: 'Giao sẵn thùng đá tại băng ghế dự bị cho 2 đội.',
      unitLabel: 'lốc',
      unitPrice: 145_000,
      maxQty: 4,
      imageUrl: '/images/services/service-water-drinks.jpg',
      popular: true,
      enabled: true,
    },
    {
      id: 'tpl-bk-ball-rent',
      sportCode: 'BASKETBALL',
      category: 'EQUIPMENT',
      name: 'Thuê bóng rổ da Molten BG4500 / Wilson Evo',
      description: 'Bóng da size 7 tiêu chuẩn FIBA cho mặt sàn gỗ Maple.',
      unitLabel: 'quả',
      unitPrice: 50_000,
      maxQty: 4,
      imageUrl: '/images/services/service-basketball-ball.jpg',
      popular: true,
      enabled: true,
    },
    {
      id: 'tpl-bk-scoreboard-op',
      sportCode: 'BASKETBALL',
      category: 'SUPPORT',
      name: 'Vận hành bảng điểm điện tử & đồng hồ 24s',
      description: 'Nhân viên bấm giờ, tính lỗi cá nhân & shot-clock chuẩn trận.',
      unitLabel: 'trận',
      unitPrice: 150_000,
      maxQty: 1,
      imageUrl: '/images/services/service-scoreboard.jpg',
      popular: true,
      enabled: true,
    },
    {
      id: 'tpl-bk-sport-tape',
      sportCode: 'BASKETBALL',
      category: 'FACILITY',
      name: 'Băng keo thể thao quấn cổ chân / cổ tay',
      description: 'Giảm nguy cơ lật sơ-mi khi tranh chấp & bật nhảy.',
      unitLabel: 'cuộn',
      unitPrice: 35_000,
      maxQty: 6,
      imageUrl: '/images/services/service-recovery-ice.jpg',
      enabled: true,
    },
  ],
};

export function getSuggestedTemplatesBySport(sportCode?: string): CourtServiceOption[] {
  if (!sportCode) return [];
  return SUGGESTED_TEMPLATES_BY_SPORT[sportCode.toUpperCase()] ?? [];
}

/**
 * Returns only the ACTIVE services explicitly configured by the Lessor for a specific court listing.
 * Never falls back to global defaults — if the Lessor has not added products, returns [].
 */
export function getActiveLessorServices(listing?: PublishedListing | null): CourtServiceOption[] {
  if (!listing?.addOnServices) return [];
  return listing.addOnServices.filter((s) => s.enabled !== false);
}

const LESSOR_SERVICES_STORAGE_KEY = 'arenapulse_lessor_services_by_group_v1';

/**
 * Initial sample configurations representing what different Lessors actually added in their own workspaces.
 * Notice how each venue has a distinct subset — and some venues have 0 products configured!
 */
function buildInitialLessorProductsForListing(listing: PublishedListing): CourtServiceOption[] {
  const templates = getSuggestedTemplatesBySport(listing.sportCode);
  const cloneWithGroup = (tpl: CourtServiceOption, overridePrice?: number): CourtServiceOption => ({
    ...tpl,
    id: `${listing.groupId}__${tpl.id}`,
    unitPrice: overridePrice ?? tpl.unitPrice,
    enabled: true,
  });

  switch (listing.groupCode) {
    case 'PICKLEBALL_MAIN':
      // Bách Khoa SportHub configured 4 items
      return templates
        .filter((t) =>
          ['tpl-pb-isotonic-bottle', 'tpl-pb-drink-towel-combo', 'tpl-pb-paddle-carbon', 'tpl-pb-balls-pack'].includes(
            t.id
          )
        )
        .map((t) => cloneWithGroup(t));

    case 'FOOTBALL_FIFA_7V7':
      // Mỹ Đình Arena configured 5 items with their own pricing
      return templates
        .filter((t) =>
          [
            'tpl-fb-water-case',
            'tpl-fb-iced-tea-jug',
            'tpl-fb-match-ball',
            'tpl-fb-bibs-set',
            'tpl-fb-referee',
          ].includes(t.id)
        )
        .map((t) => cloneWithGroup(t));

    case 'BADMINTON_PRO':
    case 'BADMINTON_BWF':
      // Badminton hub configured only drinks + shuttlecocks
      return templates
        .filter((t) => ['tpl-bm-isotonic-bottle', 'tpl-bm-shuttle-tc', 'tpl-bm-racket-rent'].includes(t.id))
        .map((t) => cloneWithGroup(t));

    case 'BASKETBALL_FIBA':
    case 'BASKETBALL_MAPLE':
      // Thủ Thiêm configured 3 items
      return templates
        .filter((t) => ['tpl-bk-isotonic-pack', 'tpl-bk-ball-rent', 'tpl-bk-scoreboard-op'].includes(t.id))
        .map((t) => cloneWithGroup(t));

    default:
      // Other venues (e.g., Westlake Tennis / Secondary courts) have NOT added online add-on services yet -> []!
      return [];
  }
}

export function loadPersistedLessorServicesMap(): Record<string, CourtServiceOption[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LESSOR_SERVICES_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CourtServiceOption[]>) : {};
  } catch {
    return {};
  }
}

export function savePersistedLessorServicesForGroup(
  groupId: string,
  services: CourtServiceOption[]
): void {
  if (typeof window === 'undefined') return;
  try {
    const map = loadPersistedLessorServicesMap();
    map[groupId] = services;
    window.localStorage.setItem(LESSOR_SERVICES_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

export function hydrateListingsWithLessorServices(
  listings: PublishedListing[]
): PublishedListing[] {
  const savedMap = loadPersistedLessorServicesMap();
  return listings.map((listing) => {
    if (Object.prototype.hasOwnProperty.call(savedMap, listing.groupId)) {
      return { ...listing, addOnServices: savedMap[listing.groupId] };
    }
    if (listing.addOnServices !== undefined) {
      return listing;
    }
    return {
      ...listing,
      addOnServices: buildInitialLessorProductsForListing(listing),
    };
  });
}

const SPORT_FALLBACK_IMAGES: Array<[string, string]> = [
  ['BÓNG ĐÁ', '/images/court-football-night.jpg'],
  ['FOOTBALL', '/images/court-football-night.jpg'],
  ['CẦU LÔNG', '/images/court-badminton-arena.jpg'],
  ['BADMINTON', '/images/court-badminton-arena.jpg'],
  ['TENNIS', '/images/court-tennis-pro.jpg'],
  ['QUẦN VỢT', '/images/court-tennis-pro.jpg'],
  ['BÓNG RỔ', '/images/court-basketball-fiba.jpg'],
  ['BASKETBALL', '/images/court-basketball-fiba.jpg'],
];

/**
 * Resolves a court listing thumbnail with a sport-matched fallback image for booking orders.
 */
export function resolveCourtThumbnail(imageUrl?: string, sportHint?: string): string {
  if (imageUrl && imageUrl.trim()) {
    return imageUrl;
  }
  const upper = (sportHint ?? '').toUpperCase();
  for (const [keyword, url] of SPORT_FALLBACK_IMAGES) {
    if (upper.includes(keyword)) {
      return url;
    }
  }
  return '/images/court-pickleball-dome.jpg';
}
