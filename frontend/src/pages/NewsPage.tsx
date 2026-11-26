import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type {
  AppPageId,
  AuthSession,
  NewsArticleItem,
  NewsCategory,
  RoleCode,
} from '../types/marketplace';
import { EXPO_EASE, ScrollReveal } from '../components/motionPrimitives';
import { ActionButton, PillSelect } from '../components/FairwayControls';

interface NewsPageProps {
  articles: NewsArticleItem[];
  activeRole: RoleCode;
  session: AuthSession | null;
  onNavigate: (page: AppPageId) => void;
  onPublishArticle: (article: Omit<NewsArticleItem, 'id' | 'slug' | 'publishedDate'>) => void;
}

const NEWS_CAT_LABELS: Record<NewsCategory | 'ALL', string> = {
  ALL: 'Tất cả chuyên mục',
  YIELD_TECH: 'Công nghệ & Định giá',
  COURT_GUIDE: 'Cẩm nang Mặt sân',
  FINANCE_LAW: 'Tài chính & Pháp lý',
  COMMUNITY: 'Cộng đồng & Đối tác',
};

export const NewsPage: React.FC<NewsPageProps> = ({
  articles,
  activeRole,
  session,
  onNavigate,
  onPublishArticle,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<NewsCategory | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [showComposer, setShowComposer] = useState<boolean>(false);

  // Admin-only article composer state
  const [draftCat, setDraftCat] = useState<NewsCategory>('YIELD_TECH');
  const [draftTitle, setDraftTitle] = useState<string>('');
  const [draftSapo, setDraftSapo] = useState<string>('');
  const [draftHeading, setDraftHeading] = useState<string>('Phân tích chi tiết');
  const [draftBody, setDraftBody] = useState<string>('');
  const [draftQuote, setDraftQuote] = useState<string>('');

  const isAdmin = Boolean(session && activeRole === 'ADMIN');

  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return articles.filter((a) => {
      const matchCat = selectedCategory === 'ALL' || a.category === selectedCategory;
      const matchQ =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.sapo.toLowerCase().includes(q) ||
        a.authorName.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [articles, selectedCategory, searchQuery]);

  const activeArticle = useMemo(
    () => (activeArticleId ? articles.find((a) => a.id === activeArticleId) ?? null : null),
    [articles, activeArticleId]
  );

  const leadArticle = useMemo(
    () => filteredArticles.find((a) => a.featured) ?? filteredArticles[0] ?? null,
    [filteredArticles]
  );

  const openArticle = (article: NewsArticleItem) => {
    setActiveArticleId(article.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCopyShareLink = (slug: string) => {
    const url = `${window.location.origin}/news#${slug}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 1800);
  };

  const handleCreateArticle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !draftTitle.trim() || !draftSapo.trim() || !draftBody.trim()) return;
    const paragraphs = draftBody
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    onPublishArticle({
      category: draftCat,
      categoryLabel: NEWS_CAT_LABELS[draftCat],
      title: draftTitle.trim(),
      sapo: draftSapo.trim(),
      authorName: session?.fullName ?? 'Ban Biên Tập ArenaPulse',
      authorRole: 'Quản trị Hệ thống ArenaPulse.vn',
      readMinutes: Math.max(2, Math.ceil(paragraphs.join(' ').split(/\s+/).length / 180)),
      coverImageUrl: '/images/sport-complex-aerial.jpg',
      imageCaption: 'Bài viết phân tích chính thức từ Ban Biên Tập ArenaPulse.vn.',
      featured: false,
      pullQuote: draftQuote.trim() || draftSapo.trim(),
      keyTakeaways: [
        'Cập nhật trực tiếp từ hệ thống vận hành ArenaPulse.vn.',
        'Áp dụng cho toàn bộ người chơi và đối tác cụm sân.',
      ],
      sections: [
        {
          heading: draftHeading.trim() || 'Nội dung bài viết',
          paragraphs,
        },
      ],
      ctaLabel: 'Khám phá danh sách sân →',
      ctaTargetPage: 'courts',
    });
    setDraftTitle('');
    setDraftSapo('');
    setDraftBody('');
    setDraftQuote('');
    setShowComposer(false);
  };

  // =========================================================================
  // FULL NEWSPAPER ARTICLE READER VIEW
  // =========================================================================
  if (activeArticle) {
    const related = articles.filter((a) => a.id !== activeArticle.id).slice(0, 3);
    return (
      <article className="bg-white pt-24 pb-20 sm:pt-28">
        <div className="mx-auto max-w-[1160px] px-4 sm:px-8">
          {/* Breadcrumb & Back */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/80 pb-4 text-xs">
            <div className="flex items-center gap-2 text-neutral-500">
              <button
                type="button"
                onClick={() => onNavigate('home')}
                className="hover:text-[#0F172A]"
              >
                Trang chủ
              </button>
              <span>/</span>
              <button
                type="button"
                onClick={() => setActiveArticleId(null)}
                className="hover:text-[#0F172A]"
              >
                Bài viết
              </button>
              <span>/</span>
              <span className="font-semibold text-[#16422C]">{activeArticle.categoryLabel}</span>
            </div>

            <button
              type="button"
              onClick={() => setActiveArticleId(null)}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-[#F8FAFC] px-3.5 py-1.5 font-semibold text-[#0F172A] hover:border-neutral-400"
            >
              <span>←</span>
              <span>Quay lại trang Bài viết</span>
            </button>
          </div>

          {/* Editorial Headline */}
          <motion.header
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EXPO_EASE }}
            className="mx-auto mt-8 max-w-4xl"
          >
            <span className="inline-block rounded-full bg-[#E7F7D4] px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#16422C]">
              {activeArticle.categoryLabel}
            </span>

            <h1 className="mt-4 text-3xl sm:text-[42px] font-semibold leading-[1.16] tracking-[-0.025em] text-[#0F172A]">
              {activeArticle.title}
            </h1>

            <p className="mt-4 text-base sm:text-lg font-medium leading-relaxed text-neutral-600">
              {activeArticle.sapo}
            </p>

            {/* Author Byline */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-y border-neutral-200/80 py-4 text-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#16422C] text-sm font-bold text-[#E7F7D4]">
                  {activeArticle.authorName.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold text-[#0F172A]">{activeArticle.authorName}</div>
                  <div className="text-neutral-500">
                    {activeArticle.authorRole} • Đăng ngày {activeArticle.publishedDate} •{' '}
                    {activeArticle.readMinutes} phút đọc
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleCopyShareLink(activeArticle.slug)}
                className="rounded-full border border-neutral-200 bg-white px-4 py-1.5 font-semibold text-[#0F172A] hover:border-neutral-400"
              >
                {copiedLink ? 'Đã sao chép link ✓' : 'Sao chép liên kết bài báo'}
              </button>
            </div>
          </motion.header>

          {/* Hero Figure */}
          <motion.figure
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.08, ease: EXPO_EASE }}
            className="mx-auto mt-8 max-w-4xl overflow-hidden rounded-[26px] border border-neutral-200/70 bg-neutral-50"
          >
            <img
              src={activeArticle.coverImageUrl}
              alt={activeArticle.title}
              className="max-h-[460px] w-full object-cover"
            />
            <figcaption className="px-5 py-3 text-xs italic text-neutral-500">
              {activeArticle.imageCaption}
            </figcaption>
          </motion.figure>

          {/* 2-Column Newspaper Body + Related Articles */}
          <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="lg:col-span-8 space-y-8">
              {/* Key Takeaways Box */}
              <div className="rounded-2xl border border-[#16422C]/20 bg-[#F4F8F4] p-5 sm:p-6">
                <div className="text-xs font-bold uppercase tracking-[0.1em] text-[#16422C]">
                  Tóm tắt điểm chính
                </div>
                <ul className="mt-3 space-y-2 text-sm text-[#0F172A]">
                  {activeArticle.keyTakeaways.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#16422C]" />
                      <span className="leading-relaxed">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Long-form Sections */}
              {activeArticle.sections.map((section, idx) => (
                <section key={idx} className="space-y-3.5">
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#0F172A]">
                    {section.heading}
                  </h2>
                  {section.paragraphs.map((p, pIdx) => (
                    <p key={pIdx} className="text-[15.5px] leading-[1.85] text-neutral-700">
                      {p}
                    </p>
                  ))}

                  {idx === 0 && (
                    <blockquote className="my-6 rounded-r-2xl border-l-4 border-[#16422C] bg-[#F8FAFC] p-5 text-base font-medium italic leading-relaxed text-[#0F172A]">
                      “{activeArticle.pullQuote}”
                    </blockquote>
                  )}
                </section>
              ))}

              {/* Bottom CTA */}
              {activeArticle.ctaLabel && activeArticle.ctaTargetPage && (
                <div className="flex flex-col justify-between gap-4 rounded-2xl bg-[#0F172A] p-6 text-white sm:flex-row sm:items-center">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-[#E7F7D4]">
                      Trải nghiệm thực tế trên ArenaPulse.vn
                    </div>
                    <div className="mt-1 text-base font-semibold">
                      Áp dụng ngay kiến thức bài viết vào lượt đặt sân tiếp theo
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate(activeArticle.ctaTargetPage!)}
                    className="shrink-0 rounded-full bg-[#E7F7D4] px-5 py-2.5 text-xs font-semibold text-[#0B2217] transition-colors hover:bg-white"
                  >
                    {activeArticle.ctaLabel}
                  </button>
                </div>
              )}
            </div>

            {/* Right Related Stories */}
            <aside className="lg:col-span-4 space-y-5 lg:sticky lg:top-24 self-start">
              <div className="rounded-2xl border border-neutral-200 bg-[#F8FAFC] p-5 space-y-4">
                <h3 className="border-b border-neutral-200 pb-2.5 text-sm font-semibold text-[#0F172A]">
                  Bài viết đọc tiếp
                </h3>
                <div className="space-y-4">
                  {related.map((rel) => (
                    <button
                      key={rel.id}
                      type="button"
                      onClick={() => openArticle(rel)}
                      className="group block w-full text-left"
                    >
                      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#16422C]">
                        {rel.categoryLabel}
                      </div>
                      <div className="mt-1 text-xs sm:text-[13px] font-semibold leading-snug text-[#0F172A] group-hover:text-[#16422C] group-hover:underline">
                        {rel.title}
                      </div>
                      <div className="mt-1 text-[11px] text-neutral-400">
                        {rel.publishedDate} • {rel.readMinutes} phút đọc
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </article>
    );
  }

  // =========================================================================
  // NEWSPAPER / EDITORIAL MAGAZINE FRONTPAGE
  // =========================================================================
  return (
    <section className="bg-[#FAFBF9] pt-24 pb-20 sm:pt-28">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
        {/* Newspaper Masthead */}
        <ScrollReveal className="border-b-2 border-[#0F172A] pb-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#16422C]">
                Chuyên trang Tạp chí Thể thao &amp; Công nghệ • ArenaPulse.vn
              </div>
              <h1 className="mt-2 text-3xl sm:text-[44px] font-semibold leading-[1.08] tracking-[-0.03em] text-[#0F172A]">
                Bài viết, Phân tích &amp; Cẩm nang Sân bãi
              </h1>
              <p className="mt-2 max-w-2xl text-sm sm:text-[15px] text-neutral-500">
                Các bài báo chuyên sâu về công nghệ định giá động, kỹ thuật chọn sân thi đấu, cơ chế
                ký quỹ bảo vệ người chơi và tiêu chuẩn vận hành đối tác.
              </p>
            </div>

            {isAdmin && (
              <ActionButton
                variant="forest"
                size="sm"
                onClick={() => setShowComposer((v) => !v)}
              >
                {showComposer ? 'Đóng trình soạn bài' : '+ Viết bài báo mới (Admin)'}
              </ActionButton>
            )}
          </div>
        </ScrollReveal>

        {/* Admin-Only Article Composer */}
        <AnimatePresence>
          {isAdmin && showComposer && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: EXPO_EASE }}
              onSubmit={handleCreateArticle}
              className="mt-6 overflow-hidden rounded-[24px] border border-[#16422C]/25 bg-white p-6 shadow-sm space-y-4 text-xs"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-[#0F172A]">
                  Xuất bản bài viết mới lên Chuyên trang Báo chí (Admin)
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                <div>
                  <label htmlFor="news-cat" className="mb-1 block font-medium text-neutral-700">
                    Chuyên mục
                  </label>
                  <PillSelect
                    id="news-cat"
                    variant="field"
                    ariaLabel="Chuyên mục"
                    value={draftCat}
                    onChange={(v) => setDraftCat(v as NewsCategory)}
                    options={[
                      { value: 'YIELD_TECH', label: 'Công nghệ & Định giá' },
                      { value: 'COURT_GUIDE', label: 'Cẩm nang Mặt sân' },
                      { value: 'FINANCE_LAW', label: 'Tài chính & Pháp lý' },
                      { value: 'COMMUNITY', label: 'Cộng đồng & Đối tác' },
                    ]}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="news-title" className="mb-1 block font-medium text-neutral-700">
                    Tiêu đề bài báo *
                  </label>
                  <input
                    id="news-title"
                    type="text"
                    required
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="Nhập tít bài hấp dẫn…"
                    className="w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[#0F172A]"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label htmlFor="news-sapo" className="mb-1 block font-medium text-neutral-700">
                    Sapo (Tóm tắt mở đầu) *
                  </label>
                  <input
                    id="news-sapo"
                    type="text"
                    required
                    value={draftSapo}
                    onChange={(e) => setDraftSapo(e.target.value)}
                    placeholder="Đoạn mở đầu tóm tắt trọng tâm bài viết…"
                    className="w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[#0F172A]"
                  />
                </div>
                <div>
                  <label htmlFor="news-head" className="mb-1 block font-medium text-neutral-700">
                    Tiêu đề mục chính
                  </label>
                  <input
                    id="news-head"
                    type="text"
                    value={draftHeading}
                    onChange={(e) => setDraftHeading(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[#0F172A]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="news-quote" className="mb-1 block font-medium text-neutral-700">
                    Trích dẫn nổi bật (Pull-Quote)
                  </label>
                  <input
                    id="news-quote"
                    type="text"
                    value={draftQuote}
                    onChange={(e) => setDraftQuote(e.target.value)}
                    placeholder="Câu trích dẫn nhấn mạnh giữa bài…"
                    className="w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[#0F172A]"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label htmlFor="news-body" className="mb-1 block font-medium text-neutral-700">
                    Nội dung chi tiết (xuống dòng để tách đoạn) *
                  </label>
                  <textarea
                    id="news-body"
                    rows={4}
                    required
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[#0F172A]"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <ActionButton type="submit" variant="forest" size="md">
                  Đăng bài báo
                </ActionButton>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Category Filter Tabs & Search */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(NEWS_CAT_LABELS) as (NewsCategory | 'ALL')[]).map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className="relative rounded-full px-4 py-1.5 text-xs font-semibold transition-colors"
                >
                  {active ? (
                    <motion.span
                      layoutId="news-cat-pill"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="absolute inset-0 rounded-full bg-[#0F172A]"
                    />
                  ) : (
                    <span className="absolute inset-0 rounded-full border border-neutral-200 bg-white" />
                  )}
                  <span className={`relative z-10 ${active ? 'text-white' : 'text-neutral-600 hover:text-[#0F172A]'}`}>
                    {NEWS_CAT_LABELS[cat]}
                  </span>
                </button>
              );
            })}
          </div>

          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm tên bài báo, tác giả..."
            className="w-full sm:w-64 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs text-[#0F172A] focus:border-[#16422C] focus:outline-none"
          />
        </div>

        {/* Classic Newspaper Top Section: Lead Story (8 cols) + Top Reads (4 cols) */}
        {leadArticle && (
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
            <motion.article
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.08 }}
              transition={{ duration: 0.48, ease: EXPO_EASE }}
              whileHover={{ y: -3 }}
              onClick={() => openArticle(leadArticle)}
              className="group cursor-pointer lg:col-span-8 overflow-hidden rounded-[26px] border border-neutral-200/80 bg-white shadow-xs transition-shadow hover:shadow-lg"
            >
              <div className="relative h-64 sm:h-80 overflow-hidden">
                <img
                  src={leadArticle.coverImageUrl}
                  alt={leadArticle.title}
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
                <span className="absolute left-5 top-5 rounded-full bg-[#16422C] px-3.5 py-1 text-[11px] font-semibold text-[#E7F7D4]">
                  {leadArticle.categoryLabel}
                </span>
              </div>
              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                  <strong className="text-[#0F172A]">{leadArticle.authorName}</strong>
                  <span>•</span>
                  <span>{leadArticle.publishedDate}</span>
                  <span>•</span>
                  <span>{leadArticle.readMinutes} phút đọc</span>
                </div>
                <h2 className="mt-3 text-2xl sm:text-[28px] font-semibold leading-tight tracking-tight text-[#0F172A] group-hover:text-[#16422C] transition-colors">
                  {leadArticle.title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                  {leadArticle.sapo}
                </p>
                <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#16422C]">
                  <span>Đọc bài viết đầy đủ</span>
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </div>
              </div>
            </motion.article>

            {/* Right Top Reads / Most Popular Editorial Sidebar */}
            <ScrollReveal
              delay={0.08}
              direction="right"
              className="lg:col-span-4 rounded-[26px] border border-neutral-200/80 bg-white p-6 flex flex-col justify-between"
            >
              <div>
                <div className="border-b border-neutral-200 pb-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-[#0F172A]">
                    Đọc nhiều tuần này
                  </h2>
                  <span className="text-[11px] text-neutral-400">Tạp chí ArenaPulse</span>
                </div>
                <div className="mt-4 divide-y divide-neutral-100">
                  {articles.map((item, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openArticle(item)}
                      className="group flex w-full items-start gap-3.5 py-3.5 text-left first:pt-1"
                    >
                      <span className="tabular-nums text-2xl font-bold leading-none text-neutral-300 group-hover:text-[#16422C] transition-colors">
                        0{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-semibold text-[#16422C]">
                          {item.categoryLabel}
                        </div>
                        <h3 className="mt-0.5 text-xs sm:text-[13px] font-semibold leading-snug text-[#0F172A] group-hover:underline">
                          {item.title}
                        </h3>
                        <div className="mt-1 text-[11px] text-neutral-400">
                          {item.readMinutes} phút đọc
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-[#F4F8F4] border border-[#16422C]/15 p-4 text-xs">
                <div className="font-semibold text-[#16422C]">Cần thông báo vận hành khẩn?</div>
                <p className="mt-1 text-neutral-600">
                  Theo dõi lịch bảo trì sân, thời tiết mưa và hộp tin cá nhân tại mục Thông báo.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('announcements')}
                  className="mt-2 font-semibold text-[#0F172A] hover:underline"
                >
                  Chuyển sang Thông báo →
                </button>
              </div>
            </ScrollReveal>
          </div>
        )}

        {/* Secondary Multi-Column Article Grid */}
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredArticles
            .filter((a) => a.id !== leadArticle?.id)
            .map((article, idx) => (
              <motion.article
                key={article.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.08 }}
                transition={{ duration: 0.46, delay: Math.min(idx * 0.06, 0.24), ease: EXPO_EASE }}
                whileHover={{ y: -3 }}
                onClick={() => openArticle(article)}
                className="group cursor-pointer overflow-hidden rounded-[24px] border border-neutral-200/85 bg-white shadow-2xs transition-shadow hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={article.coverImageUrl}
                      alt={article.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                    <span className="absolute left-3.5 top-3.5 rounded-full bg-white/95 px-3 py-0.5 text-[10.5px] font-semibold text-[#16422C] backdrop-blur-xs">
                      {article.categoryLabel}
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="text-base sm:text-[17px] font-semibold leading-snug text-[#0F172A] group-hover:text-[#16422C] transition-colors">
                      {article.title}
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-neutral-600 line-clamp-3">
                      {article.sapo}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3 text-[11px] text-neutral-500">
                  <span>{article.authorName}</span>
                  <span>{article.readMinutes} phút đọc →</span>
                </div>
              </motion.article>
            ))}
        </div>
      </div>
    </section>
  );
};
