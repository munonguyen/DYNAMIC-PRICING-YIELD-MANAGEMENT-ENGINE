import React from 'react';
import { Modal, View, StyleSheet } from 'react-native';
import { useAppState } from '@/hooks/useAppState';
import { SafeScreen } from '@/components/common/SafeScreen';
import { AppHeader } from '@/components/common/AppHeader';
import { MobileTabBar } from '@/navigation/MobileTabBar';
import { HomeScreen } from '@/screens/HomeScreen';
import { CourtsScreen } from '@/screens/CourtsScreen';
import { LessorShopScreen } from '@/screens/LessorShopScreen';
import { CommunityScreen } from '@/screens/CommunityScreen';
import { GovernanceScreen } from '@/screens/GovernanceScreen';
import { CourtDetailScreen } from '@/screens/CourtDetailScreen';
import { CheckoutScreen } from '@/screens/CheckoutScreen';
import { ChatScreen } from '@/screens/ChatScreen';
import { PricingStudioScreen } from '@/screens/PricingStudioScreen';
import { LoginScreen } from '@/screens/LoginScreen';

export const RootNavigator: React.FC = () => {
  const app = useAppState();

  return (
    <SafeScreen>
      <AppHeader
        title="ArenaPulse.vn"
        subtitle="Hệ sinh thái Sân Thể Thao & Gian hàng"
        activeRole={app.activeRole}
        isAuthenticated={Boolean(app.session)}
        unreadChatCount={app.totalUnreadChat}
        onOpenChat={() => app.setActiveModal('chat')}
        onOpenAuth={() => app.setActiveModal('login')}
      />

      <View style={styles.body}>
        {app.activeTab === 'home' ? (
          <HomeScreen
            listings={app.listings}
            activeRole={app.activeRole}
            onBrowseSport={(sport) => {
              app.setSelectedSport(sport);
              app.setActiveTab('courts');
            }}
            onOpenCourt={(listing) => app.openCourtDetail(listing)}
            onOpenLessorShop={app.openLessorShop}
            onOpenPricingStudio={() => app.setActiveModal('pricingStudio')}
          />
        ) : null}

        {app.activeTab === 'courts' ? (
          <CourtsScreen
            listings={app.listings}
            selectedSport={app.selectedSport}
            onSelectSport={app.setSelectedSport}
            onOpenCourt={(listing) => app.openCourtDetail(listing)}
            onOpenLessorShop={app.openLessorShop}
            onOpenChatForListing={(listing) =>
              app.openChatWithProvider(listing.provider.providerId, listing)
            }
          />
        ) : null}

        {app.activeTab === 'lessors' ? (
          <LessorShopScreen
            listings={app.listings}
            selectedProviderId={app.selectedProviderId}
            followedProviderIds={app.followedProviderIds}
            onSelectProviderId={app.setSelectedProviderId}
            onToggleFollow={app.toggleFollowProvider}
            onOpenChat={app.openChatWithProvider}
            onOpenCourt={(listing) => app.openCourtDetail(listing)}
          />
        ) : null}

        {app.activeTab === 'community' ? (
          <CommunityScreen
            announcements={app.announcements}
            activeRole={app.activeRole}
            isAuthenticated={Boolean(app.session)}
            onPublishAnnouncement={app.publishAnnouncement}
            onOpenLessorShop={app.openLessorShop}
          />
        ) : null}

        {app.activeTab === 'account' ? (
          <GovernanceScreen
            session={app.session}
            activeRole={app.activeRole}
            onSwitchRole={app.setActiveRole}
            onOpenPricingStudio={() => app.setActiveModal('pricingStudio')}
            onOpenLogin={() => app.setActiveModal('login')}
            onSignOut={app.signOut}
          />
        ) : null}
      </View>

      <MobileTabBar activeTab={app.activeTab} onSelectTab={app.setActiveTab} />

      {/* Fullscreen Modal Stack for Detail, Checkout, Shopee Chat, Internal Pricing & Auth */}
      <Modal
        visible={app.activeModal !== null}
        animationType="slide"
        onRequestClose={() => app.setActiveModal(null)}
      >
        {app.activeModal === 'courtDetail' ? (
          <CourtDetailScreen
            listing={app.activeListing}
            activeSlotStart={app.activeSlotStart}
            activeQuote={app.activeQuote}
            countdownLabel={app.countdown.formatted}
            onSelectSlot={app.selectCourtSlot}
            onProceedToCheckout={() => app.setActiveModal('checkout')}
            onOpenLessorShop={app.openLessorShop}
            onOpenChat={(listing) =>
              app.openChatWithProvider(listing.provider.providerId, listing)
            }
            onBack={() => app.setActiveModal(null)}
          />
        ) : null}

        {app.activeModal === 'checkout' ? (
          <CheckoutScreen
            listing={app.activeListing}
            quote={app.activeQuote}
            countdownLabel={app.countdown.formatted}
            holdResult={app.holdResult}
            onUpdateHoldResult={app.setHoldResult}
            onBack={() => app.setActiveModal('courtDetail')}
          />
        ) : null}

        {app.activeModal === 'chat' ? (
          <ChatScreen
            listings={app.listings}
            activeProviderId={app.activeChatProviderId}
            threadsByProvider={app.threadsByProvider}
            onSelectProviderId={app.setActiveChatProviderId}
            onSendMessage={app.sendChatMessage}
            onOpenLessorShop={app.openLessorShop}
            onSelectCourtFromChat={(listing) => app.openCourtDetail(listing)}
            onClose={() => app.setActiveModal(null)}
          />
        ) : null}

        {app.activeModal === 'pricingStudio' ? (
          <PricingStudioScreen
            listings={app.listings}
            activeRole={app.activeRole}
            isAuthenticated={Boolean(app.session)}
            onSavePricing={app.updateListingPricing}
            onOpenLogin={() => app.setActiveModal('login')}
            onBack={() => app.setActiveModal(null)}
          />
        ) : null}

        {app.activeModal === 'login' ? (
          <LoginScreen
            onSelectAccount={app.signInWithRole}
            onBack={() => app.setActiveModal(null)}
          />
        ) : null}
      </Modal>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  body: { flex: 1 },
});

