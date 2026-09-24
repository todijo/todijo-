import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:todijo/src/core/localization/todijo_localizations.dart';

void main() {
  test('all 14 mobile locales have the same non-empty copy keys', () {
    final copy = TodijoLocalizations.debugCopy;
    expect(copy.keys.toSet(), todijoLocaleCodes.toSet());
    final expectedKeys = copy['fr']!.keys.toSet();
    expect(expectedKeys, isNotEmpty);
    for (final locale in todijoLocaleCodes) {
      expect(copy[locale]!.keys.toSet(), expectedKeys, reason: locale);
      for (final entry in copy[locale]!.entries) {
        expect(entry.value.trim(), isNotEmpty, reason: '$locale:${entry.key}');
        expect(
          TodijoLocalizations(Locale(locale)).text(entry.key),
          entry.value,
          reason: '$locale:${entry.key}',
        );
      }
    }
  });

  test('RTL locales remain distinct from country and currency selection', () {
    expect(todijoRtlLocaleCodes, {'ar', 'fa', 'ku'});
    expect(TodijoLocalizations(const Locale('fr')).text('cart'), isNotEmpty);
  });

  test('loyalty euro-credit copy is complete in all 14 locales', () {
    const keys = [
      'title',
      'intro',
      'available',
      'pending',
      'expiringSoon',
      'store',
      'history',
      'emptyHistory',
      'earnedPending',
      'earnedAvailable',
      'redeemed',
      'restored',
      'reversed',
      'expired',
      'adjusted',
      'owed',
      'participation',
      'enabled',
      'disabled',
      'globalRate',
      'reserve',
      'eligibleProducts',
      'save',
      'blocked',
      'unavailable',
    ];
    for (final locale in todijoLocaleCodes) {
      final copy = TodijoLocalizations(Locale(locale));
      for (final key in keys) {
        expect(
          copy.text('loyalty.$key').trim(),
          isNotEmpty,
          reason: '$locale:loyalty.$key',
        );
      }
      for (final key in [
        'activate',
        'deactivate',
        'releaseReference',
        'confirmation',
        'gateClosed',
        'adjustment',
      ]) {
        expect(copy.text('loyaltyAdminAction.$key').trim(), isNotEmpty);
      }
      for (final key in [
        'pledge',
        'attest',
        'cancelPledge',
        'revoke',
        'sellerRepair',
        'buyerId',
        'storeId',
        'amountEuro',
        'reference',
        'grantId',
        'orderItemId',
        'evidence',
        'note',
      ]) {
        expect(copy.text('loyaltyAdminAdjustment.$key').trim(), isNotEmpty);
      }
      expect(
        copy.text('loyaltyCheckout.reserved'),
        isNotEmpty,
        reason: '$locale:reserved',
      );
    }
  });

  test('admin loyalty controls are translated in all 14 locales', () {
    const keys = [
      'settings',
      'ratePercent',
      'minPercent',
      'maxPercent',
      'expiryDays',
      'reason',
      'rateHistory',
      'sellerParticipation',
      'block',
      'unblock',
      'updateFailed',
      'rolloutPaused',
      'changedAt',
      'noHistory',
      'balanced',
      'anomaly',
    ];
    for (final locale in todijoLocaleCodes) {
      final copy = TodijoLocalizations(Locale(locale));
      for (final key in keys) {
        expect(
          copy.text('loyaltyAdmin.$key').trim(),
          isNotEmpty,
          reason: '$locale:loyaltyAdmin.$key',
        );
      }
    }
  });

  test(
    'buyer order and payment states match responsive catalogs in 14 locales',
    () {
      for (final locale in todijoLocaleCodes) {
        final copy = TodijoLocalizations(Locale(locale));
        for (final status in [
          'PENDING',
          'PAID',
          'PROCESSING',
          'SHIPPED',
          'DELIVERED',
          'CANCELLED',
          'REFUNDED',
        ]) {
          expect(copy.text('orderStatus.$status'), isNotEmpty);
        }
        for (final status in ['paid', 'pending', 'cancelled', 'refunded']) {
          expect(copy.text('paymentStatus.$status'), isNotEmpty);
        }
      }
    },
  );

  test('canonical shipping countries are named in every mobile locale', () {
    final countries = TodijoLocalizations.shippingCountries;
    expect(countries.length, greaterThan(200));
    expect(countries.toSet().length, countries.length);
    expect(countries, containsAll(['FR', 'US', 'TR', 'IQ']));
    for (final locale in todijoLocaleCodes) {
      final copy = TodijoLocalizations(Locale(locale));
      for (final code in countries) {
        expect(
          copy.countryName(code).trim(),
          isNotEmpty,
          reason: '$locale:$code',
        );
      }
    }
  });

  test('seller CJ discovery, quote, import and review copy exists in all 14 locales', () {
    const keys = [
      'cjDiscovery',
      'cjDuplicate',
      'cjCategory',
      'cjCategoryReview',
      'cjVariant',
      'cjDestination',
      'cjQuote',
      'cjPrice',
      'cjFreight',
      'cjRevalidate',
      'cjImportDraft',
      'cjAdminReview',
      'cjServiceUnavailable',
      'cjAvailable',
      'cjQuarantined',
    ];
    for (final locale in todijoLocaleCodes) {
      final copy = TodijoLocalizations(Locale(locale));
      for (final key in keys) {
        expect(copy.text(key).trim(), isNotEmpty, reason: '$locale:$key');
      }
    }
  });

  test('seller dashboard navigation and states exist in all 14 locales', () {
    const keys = [
      'sellerDashboard',
      'sellerProducts',
      'sellerAddProduct',
      'sellerOrders',
      'sellerStatistics',
      'sellerRevenue',
      'sellerReviews',
      'sellerStore',
      'sellerSettings',
      'sellerWorkspace',
      'sellerPendingOrders',
      'sellerCustomers',
      'sellerRecentOrders',
      'sellerEmptyOrders',
      'sellerAll',
      'sellerDraft',
      'sellerPublished',
      'sellerStock',
      'sellerAdvancePreparing',
      'sellerAdvanceShipped',
      'sellerAdvanceDelivered',
      'sellerTrackingCarrier',
      'sellerTrackingNumber',
      'sellerFulfillmentError',
      'sellerOrderQuantity',
      'sellerRefundReason',
      'sellerRefundNote',
      'sellerRefundApprove',
      'sellerRefundReject',
      'sellerRefundFailed',
      'sellerRefundEvidence',
      'sellerVariantImages',
      'sellerVariantImagesHelp',
      'sellerVariantPrimaryImage',
      'sellerMakeVariantPrimary',
      'sellerProductName',
      'sellerProductDescription',
      'sellerProductPrice',
      'sellerProductStock',
      'sellerProductCategory',
      'sellerProductPhotos',
      'sellerProductPublish',
      'sellerProductSaveDraft',
      'sellerProductSaveChanges',
      'sellerProductDelete',
      'sellerComplianceTitle',
      'sellerListingDeclaration',
      'sellerVariantOptions',
      'sellerOptionName',
      'sellerOptionValues',
      'sellerAddOption',
      'sellerGenerateVariants',
      'sellerVariantPrice',
      'sellerVariantStock',
      'sellerProductCondition',
      'sellerConditionNew',
      'sellerConditionLikeNew',
      'sellerConditionGood',
      'sellerConditionUsed',
      'sellerComparePrice',
      'sellerLogo',
      'sellerBanner',
      'sellerShippingTitle',
      'sellerShippingEnabled',
      'sellerShippingMethod',
      'sellerShippingCarrier',
      'sellerShippingPrice',
      'sellerShippingFreeThreshold',
      'sellerShippingMinDays',
      'sellerShippingMaxDays',
      'sellerShippingWorldwide',
      'sellerShippingCountries',
      'sellerShippingPostalCodes',
      'sellerPlans',
      'sellerSubscription',
      'sellerPerMonth',
      'sellerSubscribe',
      'sellerUnavailable',
      'sellerConnectStripe',
      'sellerConnected',
      'sellerChargesEnabled',
      'sellerPayoutsEnabled',
      'sellerPayments',
      'sellerUnlimited',
      'sellerTransfer.WAITING_FOR_SHIPMENT',
      'sellerTransfer.RESERVE_PERIOD',
      'sellerTransfer.READY',
      'sellerTransfer.SUBMITTING',
      'sellerTransfer.TRANSFERRED',
      'sellerTransfer.RETRYABLE',
      'sellerTransfer.MANUAL_ACTION_REQUIRED',
      'sellerTransfer.REVERSED',
      'sellerTransfer.CANCELLED',
      'sellerSubscription.NOT_STARTED',
      'sellerSubscription.INCOMPLETE',
      'sellerSubscription.TRIALING',
      'sellerSubscription.ACTIVE',
      'sellerSubscription.PAST_DUE',
      'sellerSubscription.UNPAID',
      'sellerSubscription.CANCELED',
      'sellerSubscription.EXPIRED',
      'sellerConnectStatusUnavailable',
      'sellerTransferPendingAmount',
      'dropshipping.accessTitle',
      'dropshipping.approvedNotConnected',
      'dropshipping.connectPending',
      'dropshipping.permissionDisabled',
      'sellerVerification',
      'sellerVerification.NOT_STARTED',
      'sellerVerification.IN_PROGRESS',
      'sellerVerification.PENDING_REVIEW',
      'sellerVerification.VERIFIED',
      'sellerVerification.REJECTED',
      'sellerVerification.NEEDS_INFORMATION',
      'productVideo.title',
      'productVideo.help',
      'productVideo.upload',
      'productVideo.remove',
      'productVideo.uploading',
      'productVideo.configError',
      'productVideo.failed',
    ];
    for (final locale in todijoLocaleCodes) {
      final copy = TodijoLocalizations(Locale(locale));
      for (final key in keys) {
        expect(copy.text(key).trim(), isNotEmpty, reason: '$locale:$key');
      }
    }
  });

  test('seller refund review statuses exist in all 14 locales', () {
    for (final locale in todijoLocaleCodes) {
      final copy = TodijoLocalizations(Locale(locale));
      for (final status in [
        'PENDING',
        'SELLER_APPROVED',
        'SELLER_REJECTED',
        'ADMIN_APPROVED',
        'ADMIN_REJECTED',
      ]) {
        expect(copy.text('sellerRefundStatus.$status'), isNotEmpty);
      }
    }
  });

  test('Phase 4 admin action and operations copy exists in all 14 locales', () {
    const keys = [
      'adminDashboard',
      'adminUsers',
      'adminSellers',
      'adminDropshippingEnable',
      'adminDropshippingDisable',
      'adminReason',
      'adminConfirm',
      'adminUnpublish',
      'adminReview',
      'adminResolve',
      'adminDismiss',
      'adminCms',
      'adminCmsContent',
      'adminCmsPublish',
      'adminCmsArchive',
      'adminReturnRequired',
      'adminDelete',
      'adminDeleteWarning',
      'adminDeleteBlocked',
      'adminIssues',
      'adminSubscriptions',
      'adminTransfers',
      'adminCjFulfillments',
      'adminCjImports',
      'adminCjSync',
      'adminCjSubmit',
      'adminCjSubmitWarning',
      'adminCjMargin',
      'adminSnapshotMinor',
      'adminCjCreateImport',
      'adminCjIdentifiers',
      'adminCjContinueImport',
      'adminReleaseTransfer',
      'adminReleaseTransferWarning',
      'adminRemoveListing',
      'adminRemoveWarning',
      'adminNewsDeleteWarning',
      'adminPaidOrders30d',
      'adminGrossVolume30d',
      'adminGrantAccess',
      'adminMonths',
      'adminSeoTitle',
      'adminSeoDescription',
      'adminCreateStore',
      'adminSelectOwner',
      'adminStoreName',
      'adminStoreDescription',
      'adminContactEmail',
      'adminPhone',
      'adminCity',
      'adminInitialAccess',
    ];
    for (final locale in todijoLocaleCodes) {
      final copy = TodijoLocalizations(Locale(locale));
      for (final key in keys) {
        expect(copy.text(key).trim(), isNotEmpty, reason: '$locale:$key');
        expect(copy.text(key), isNot(key), reason: '$locale:$key');
      }
    }
  });

  test('native admin and CMS controls do not fall back to English', () {
    const keys = [
      'adminReason',
      'adminActionFailed',
      'adminNoUsers',
      'adminCmsContent',
      'adminCmsDraft',
      'adminCmsSaveDraft',
      'adminCmsPublish',
      'adminCmsArchive',
      'adminCmsHistory',
      'adminSeoTitle',
      'adminSeoDescription',
      'adminDeleteWarning',
      'adminCjSubmitWarning',
    ];
    final english = TodijoLocalizations(const Locale('en'));
    for (final locale in todijoLocaleCodes.where((value) => value != 'en')) {
      final copy = TodijoLocalizations(Locale(locale));
      for (final key in keys) {
        expect(
          copy.text(key),
          isNot(english.text(key)),
          reason: '$locale:$key',
        );
      }
    }
  });

  test('all Admin copy is localized in 14 locales, except true cognates', () {
    final english = TodijoLocalizations.debugCopy['en']!;
    const cognates = {
      'fr': {'adminStoreDescription'},
      'de': {'adminStatus', 'adminModeration'},
      'nl': {'adminStatus'},
    };
    for (final locale in todijoLocaleCodes.where((value) => value != 'en')) {
      final translated = TodijoLocalizations.debugCopy[locale]!;
      for (final key in english.keys.where((key) => key.startsWith('admin'))) {
        if (cognates[locale]?.contains(key) == true) continue;
        expect(translated[key], isNot(english[key]), reason: '$locale:$key');
      }
    }
  });

  test('admin cancellation, return and dispute states are localized', () {
    for (final locale in todijoLocaleCodes) {
      final copy = TodijoLocalizations(Locale(locale));
      for (final type in ['CANCELLATION', 'RETURN', 'DISPUTE']) {
        expect(copy.text('adminIssueType.$type'), isNotEmpty);
      }
      for (final status in [
        'PENDING',
        'UNDER_REVIEW',
        'ADMIN_APPROVED',
        'ADMIN_REJECTED',
        'SELLER_APPROVED',
        'SELLER_REJECTED',
        'ESCALATED',
        'RESOLVED',
      ]) {
        expect(copy.text('adminIssueStatus.$status'), isNotEmpty);
      }
      for (final key in [
        'adminIssueDecision',
        'adminStatusOnlyWarning',
        'adminReference',
        'adminEvidence',
        'adminRecalls',
        'adminRecall',
        'adminRecallActive',
        'adminRecallRevoked',
        'adminAffectedListings',
        'adminRevocationReason',
        'adminRevokeRecall',
        'adminReactivateRecall',
        'adminReleaseRecallListing',
        'adminCreateRecall',
        'adminPlatformRecallWarning',
      ]) {
        expect(copy.text(key), isNotEmpty, reason: '$locale:$key');
      }
    }
  });

  test(
    'native auth guidance does not fall back to English in other locales',
    () {
      const keys = [
        'orEmail',
        'socialLogin',
        'googleLogin',
        'appleLogin',
        'facebookLogin',
        'providerNotConfigured',
        'emailSecurityGuidance',
        'passwordGuidance',
        'profile',
        'phone',
        'address',
        'postalCode',
        'selectCountry',
      ];
      final english = TodijoLocalizations(const Locale('en'));
      for (final locale in todijoLocaleCodes.where((value) => value != 'en')) {
        final copy = TodijoLocalizations(Locale(locale));
        for (final key in keys) {
          expect(
            copy.text(key),
            isNot(english.text(key)),
            reason: '$locale:$key',
          );
        }
      }
    },
  );

  test('loyalty checkout copy is complete in every native locale', () {
    const keys = [
      'title',
      'maximum',
      'excluded',
      'shippingExcluded',
      'useCredit',
      'newCash',
      'zeroCash',
      'previewError',
      'pending',
      'creditUsed',
      'storeOnly',
      'paymentPending',
    ];
    for (final locale in todijoLocaleCodes) {
      final copy = TodijoLocalizations(Locale(locale));
      for (final key in keys) {
        final value = copy.text('loyaltyCheckout.$key');
        expect(value, isNotEmpty, reason: '$locale:$key');
        expect(
          value,
          isNot('loyaltyCheckout.$key'),
          reason: '$locale:$key missing',
        );
      }
    }
  });

  test(
    'seller and admin settlement copy is complete in every native locale',
    () {
      const keys = [
        'order',
        'lookup',
        'cash',
        'commission',
        'sellerPayable',
        'sellerCredit',
        'platformCredit',
        'balanced',
        'anomaly',
      ];
      for (final locale in todijoLocaleCodes) {
        final copy = TodijoLocalizations(Locale(locale));
        for (final key in keys) {
          final value = copy.text('loyaltyAccounting.$key');
          expect(value, isNotEmpty, reason: '$locale:$key');
          expect(
            value,
            isNot('loyaltyAccounting.$key'),
            reason: '$locale:$key missing',
          );
        }
      }
    },
  );
}
