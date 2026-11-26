import { useEffect, useState, type FormEvent } from 'react';
import type { AuthSession, PublishedListing, RoleCode } from '../types/marketplace';
import { marketplaceApi, type VenueConversation, type VenueMessage } from '../api/marketplaceApi';

interface Props {
  open: boolean;
  onToggleOpen: (next: boolean) => void;
  activeProviderId: string | null;
  onSelectProviderId: (providerId: string | null) => void;
  contextListing: PublishedListing | null;
  listings: PublishedListing[];
  activeRole: RoleCode;
  session: AuthSession | null;
}

export function FloatingChatWidget({
  open, onToggleOpen, activeProviderId, onSelectProviderId,
  contextListing, listings, activeRole, session,
}: Props) {
  const venueOperator = activeRole === 'STAFF' || activeRole === 'MANAGER';
  const hostedTenants = new Set(session?.roles.filter((grant) =>
    grant.roleCode === activeRole && grant.scope === 'TENANT'
  ).map((grant) => grant.tenantId));
  const venues = Array.from(new Map(listings.filter((listing) =>
    venueOperator ? hostedTenants.has(listing.tenantId) : listing.published !== false
  ).map((listing) => [listing.tenantId, listing.venueName])).entries());
  const preferredTenant = activeProviderId ?? contextListing?.tenantId;
  const tenantId = venues.some(([id]) => id === preferredTenant) ? preferredTenant
    : venues[0]?.[0] ?? (venueOperator ? [...hostedTenants][0] : undefined);
  const [threads, setThreads] = useState<VenueConversation[]>([]);
  const [selected, setSelected] = useState('');
  const [messages, setMessages] = useState<VenueMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const thread = threads.find((item) => item.id === selected && item.tenantId === tenantId)
    ?? threads.find((item) => item.tenantId === tenantId);
  const threadId = thread?.id;
  const userId = session?.userId;

  useEffect(() => {
    setMessages([]);
    setThreads([]);
    setSelected('');
    setError('');
    if (!open || !userId || !tenantId) return;
    let active = true;
    const poll = async () => {
      if (document.hidden) return;
      try {
        const rows = await marketplaceApi.listConversations(venueOperator ? tenantId : undefined);
        if (active) setThreads(rows);
      } catch (error) {
        if (active) setError(error instanceof Error ? error.message : 'Không tải được cuộc trò chuyện.');
      }
    };
    void poll();
    const timer = window.setInterval(poll, 10_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [open, userId, tenantId, venueOperator]);

  useEffect(() => {
    setMessages([]);
    if (!open || !userId || !threadId) return;
    let active = true;
    const poll = async () => {
      if (document.hidden) return;
      try {
        const rows = await marketplaceApi.listMessages(threadId);
        if (active) setMessages(rows);
      } catch (error) {
        if (active) setError(error instanceof Error ? error.message : 'Không tải được tin nhắn.');
      }
    };
    void poll();
    const timer = window.setInterval(poll, 5_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [open, userId, threadId]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending || !tenantId || !userId || (venueOperator && !thread)) return;
    setSending(true);
    setError('');
    try {
      const target = thread ?? await marketplaceApi.openConversation(tenantId);
      await marketplaceApi.sendMessage(target.id, body);
      const rows = await marketplaceApi.listMessages(target.id);
      setThreads((current) => [target, ...current.filter((item) => item.id !== target.id)]);
      setSelected(target.id);
      setMessages(rows);
      setDraft('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Gửi tin nhắn thất bại.');
    } finally {
      setSending(false);
    }
  }

  if (activeRole === 'ADMIN' || activeRole === 'ACCOUNTANT') return null;
  if (!open) {
    return <button type="button" onClick={() => onToggleOpen(true)}
      className="fixed bottom-6 right-6 z-40 rounded-full bg-[#16422C] px-5 py-3 font-bold text-white shadow-lg">
      Chat với sân
    </button>;
  }
  return (
    <section aria-label="Chat với sân"
      className="fixed bottom-6 right-4 z-50 flex max-h-[75vh] w-[min(24rem,calc(100vw-2rem))] flex-col rounded-2xl border border-neutral-200 bg-white shadow-2xl">
      <header className="flex items-center justify-between rounded-t-2xl bg-[#16422C] px-4 py-3 font-bold text-white">
        Chat với sân
        <button type="button" aria-label="Đóng chat" onClick={() => onToggleOpen(false)}>✕</button>
      </header>
      {!userId ? <p className="p-4 text-sm">Đăng nhập để gửi tin nhắn.</p> : (
        <div className="min-h-0 space-y-3 overflow-y-auto p-4">
          <label className="block text-sm font-semibold">
            Cơ sở
            <select value={tenantId ?? ''} disabled={sending}
              onChange={(event) => onSelectProviderId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 p-2">
              {!venues.length && <option value={tenantId ?? ''}>Cơ sở được phân công</option>}
              {venues.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          {venueOperator && (
            <label className="block text-sm font-semibold">
              Cuộc trò chuyện
              <select value={threadId ?? ''} disabled={sending}
                onChange={(event) => setSelected(event.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 p-2">
                {!threadId && <option value="">Chưa có cuộc trò chuyện</option>}
                {threads.filter((item) => item.tenantId === tenantId).map((item) => (
                  <option key={item.id} value={item.id}>Khách {item.userId.slice(0, 8)}</option>
                ))}
              </select>
            </label>
          )}
          <ol aria-live="polite" className="max-h-64 space-y-2 overflow-y-auto text-sm">
            {messages.map((message) => (
              <li key={message.id.id} className="rounded-lg bg-neutral-100 p-2 break-words">
                <span className="block text-xs font-bold text-neutral-600">
                  {message.senderUserId === userId ? 'Bạn' : message.senderRole === 'USER' ? 'Khách' : 'Cơ sở'}
                </span>
                {message.body}
              </li>
            ))}
          </ol>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          {tenantId && (!venueOperator || thread) && (
            <form onSubmit={send} className="flex gap-2">
              <input aria-label="Tin nhắn" placeholder="Nhập tin nhắn" value={draft} maxLength={4000}
                onChange={(event) => setDraft(event.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-neutral-300 p-2 text-sm" />
              <button type="submit" disabled={sending || !draft.trim()}
                className="rounded-lg bg-[#16422C] px-4 text-sm font-bold text-white disabled:opacity-50">Gửi</button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
