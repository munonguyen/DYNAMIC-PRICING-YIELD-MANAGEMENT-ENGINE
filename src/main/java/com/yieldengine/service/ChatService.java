package com.yieldengine.service;

import com.yieldengine.record.ops.OpenConversationRequest;
import com.yieldengine.record.ops.SendMessageRequest;
import com.yieldengine.entity.*;
import com.yieldengine.exception.ResourceNotFoundException;
import com.yieldengine.exception.ForbiddenAccessException;
import com.yieldengine.repository.BookingRepository;
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
import java.util.Collections;
import java.util.ArrayList;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ChatService {

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final ConversationReadRepository conversationReadRepository;
    private final TenantRepository tenantRepository;
    private final BookingRepository bookingRepository;
    private final RbacGuard rbacGuard;
    private final AuthAndRbacValidator authValidator;
    private final BookingAndOpsValidator bookingValidator;

    @Transactional
    public Conversation openOrGetConversation(OpenConversationRequest request) {
        SessionPrincipal actor = rbacGuard.requireAuthenticated();
        authValidator.validateVenueExists(request.tenantId());

        if (request.bookingId() != null) {
            var booking = bookingRepository.findById(request.bookingId())
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt sân."));
            if (!actor.userId().equals(booking.getUserId()) || !request.tenantId().equals(booking.getTenant().getId())) {
                throw new ForbiddenAccessException("Cuộc trao đổi phải thuộc đơn và cơ sở của khách.");
            }
        }
        conversationRepository.insertIfAbsent(UUID.randomUUID(), request.tenantId(), actor.userId(), request.bookingId());
        return conversationRepository.findThread(request.tenantId(), actor.userId(), request.bookingId()).orElseThrow();
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

        var messages = new ArrayList<>(messageRepository.findByConversationIdOrderByIdCreatedAtDescIdIdDesc(
                conversationId,
                CommonTextAndPageUtils.boundedPageable(0, limit, 200)
        ));
        if (!messages.isEmpty()) markRead(conv.getId(), actor.userId(), messages.get(0).getId().getCreatedAt());
        Collections.reverse(messages);
        return messages;
    }

    @Transactional(readOnly = true)
    public List<Conversation> listMyConversations(UUID venueTenantId, int page, int size) {
        SessionPrincipal actor = rbacGuard.requireAuthenticated();
        var pagination = CommonTextAndPageUtils.boundedPageable(page, size, 100);
        if (venueTenantId != null) {
            bookingValidator.validateVenueConversationListAccess(actor, venueTenantId);
            return conversationRepository.findByTenantIdOrderByLastMessageAtDesc(venueTenantId, pagination);
        }
        return conversationRepository.findByUserIdOrderByLastMessageAtDesc(actor.userId(), pagination);
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
        conversationReadRepository.markRead(conversationId, userId, readAt);
    }
}
