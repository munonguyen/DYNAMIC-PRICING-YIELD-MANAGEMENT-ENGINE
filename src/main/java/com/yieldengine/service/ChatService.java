package com.yieldengine.service;

import com.yieldengine.record.ops.OpenConversationRequest;
import com.yieldengine.record.ops.SendMessageRequest;
import com.yieldengine.entity.*;
import com.yieldengine.exception.ResourceNotFoundException;
import com.yieldengine.repository.ConversationReadRepository;
import com.yieldengine.repository.ConversationRepository;
import com.yieldengine.repository.MessageRepository;
import com.yieldengine.repository.TenantRepository;
import com.yieldengine.security.RbacGuard;
import com.yieldengine.record.security.SessionPrincipal;
import com.yieldengine.utils.CommonTextAndPageUtils;
import com.yieldengine.validate.AuthAndRbacValidator;
import com.yieldengine.validate.BookingAndOpsValidator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ChatService {

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final ConversationReadRepository conversationReadRepository;
    private final TenantRepository tenantRepository;
    private final RbacGuard rbacGuard;
    private final AuthAndRbacValidator authValidator;
    private final BookingAndOpsValidator bookingValidator;

    @Transactional
    public Conversation openOrGetConversation(OpenConversationRequest request) {
        SessionPrincipal actor = rbacGuard.requireAuthenticated();
        authValidator.validateVenueExists(request.tenantId());

        return conversationRepository.findThread(request.tenantId(), actor.userId(), request.bookingId())
                .orElseGet(() -> conversationRepository.save(Conversation.builder()
                        .tenantId(request.tenantId())
                        .userId(actor.userId())
                        .bookingId(request.bookingId())
                        .status("OPEN")
                        .build()));
    }

    @Transactional
    public Message sendMessage(UUID conversationId, SendMessageRequest request) {
        SessionPrincipal actor = rbacGuard.requireAuthenticated();
        Conversation conv = loadConversation(conversationId);
        Tenant tenant = loadVenue(conv.getTenantId());

        String senderRole = bookingValidator.validateAndResolveChatSenderRole(actor, conv, tenant);
        Instant now = Instant.now();

        Message msg = messageRepository.save(Message.builder()
                .id(new MessageId(UUID.randomUUID(), now))
                .conversationId(conv.getId())
                .senderUserId(actor.userId())
                .senderRole(senderRole)
                .body(request.body().trim())
                .build());

        conv.setLastMessageAt(now);
        conversationRepository.save(conv);
        markRead(conv.getId(), actor.userId(), now);

        return msg;
    }

    @Transactional
    public List<Message> getMessages(UUID conversationId, int limit) {
        SessionPrincipal actor = rbacGuard.requireAuthenticated();
        Conversation conv = loadConversation(conversationId);
        Tenant tenant = loadVenue(conv.getTenantId());

        if (!actor.hasPlatformRole("ADMIN")) {
            bookingValidator.validateAndResolveChatSenderRole(actor, conv, tenant);
        }

        markRead(conv.getId(), actor.userId(), Instant.now());
        return messageRepository.findByConversationIdOrderByIdCreatedAtAsc(
                conversationId,
                CommonTextAndPageUtils.boundedPageable(0, limit, 200)
        );
    }

    @Transactional(readOnly = true)
    public List<Conversation> listMyConversations(UUID venueTenantId) {
        SessionPrincipal actor = rbacGuard.requireAuthenticated();
        if (venueTenantId != null) {
            bookingValidator.validateVenueConversationListAccess(actor, venueTenantId);
            return conversationRepository.findByTenantIdOrderByLastMessageAtDesc(venueTenantId);
        }
        return conversationRepository.findByUserIdOrderByLastMessageAtDesc(actor.userId());
    }

    private Conversation loadConversation(UUID conversationId) {
        return conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found: " + conversationId));
    }

    private Tenant loadVenue(UUID tenantId) {
        return tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Venue not found: " + tenantId));
    }

    private void markRead(UUID conversationId, UUID userId, Instant readAt) {
        conversationReadRepository.save(ConversationRead.builder()
                .id(new ConversationReadId(conversationId, userId))
                .lastReadAt(readAt)
                .build());
    }
}
