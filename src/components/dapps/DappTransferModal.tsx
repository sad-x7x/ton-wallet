import React, { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiToken } from '../../api/types';
import type { GlobalState, HardwareConnectState } from '../../global/types';
import { TransferState } from '../../global/types';

import { IS_CAPACITOR } from '../../config';
import { selectCurrentDappTransferTotals } from '../../global/selectors';
import { getDoesUsePinPad } from '../../util/biometrics';
import buildClassName from '../../util/buildClassName';
import resolveSlideTransitionName from '../../util/resolveSlideTransitionName';
import { isNftTransferPayload } from '../../util/ton/transfer';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useModalTransitionKeys from '../../hooks/useModalTransitionKeys';

import LedgerConfirmOperation from '../ledger/LedgerConfirmOperation';
import LedgerConnect from '../ledger/LedgerConnect';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import ModalHeader from '../ui/ModalHeader';
import PasswordForm from '../ui/PasswordForm';
import Transition from '../ui/Transition';
import DappLedgerWarning from './DappLedgerWarning';
import DappTransfer from './DappTransfer';
import DappTransferInitial from './DappTransferInitial';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Dapp.module.scss';

interface StateProps {
  currentDappTransfer: GlobalState['currentDappTransfer'];
  tokensBySlug: Record<string, ApiToken>;
  hardwareState?: HardwareConnectState;
  isLedgerConnected?: boolean;
  isTonAppConnected?: boolean;
  isMediaViewerOpen?: boolean;
  isDangerous: boolean;
}

const MAX_TRANSACTIONS_IN_SMALL_MODAL = 4;

function DappTransferModal({
  currentDappTransfer: {
    dapp,
    isLoading,
    viewTransactionOnIdx,
    state,
    transactions,
    error,
  },
  tokensBySlug,
  hardwareState,
  isLedgerConnected,
  isTonAppConnected,
  isMediaViewerOpen,
  isDangerous: withPayloadWarning,
}: StateProps) {
  const {
    setDappTransferScreen,
    clearDappTransferError,
    submitDappTransferPassword,
    submitDappTransferHardware,
    closeDappTransfer,
    cancelDappTransfer,
  } = getActions();

  const lang = useLang();

  const isOpen = state !== TransferState.None;

  const { renderingKey, nextKey, updateNextKey } = useModalTransitionKeys(state, isOpen);
  const renderingTransactions = useCurrentOrPrev(transactions, true);
  const isDappLoading = dapp === undefined;
  const needsExtraHeight = withPayloadWarning || (transactions?.length ?? 0) > MAX_TRANSACTIONS_IN_SMALL_MODAL;

  const handleBackClick = useLastCallback(() => {
    if (state === TransferState.Confirm || state === TransferState.Password) {
      setDappTransferScreen({ state: TransferState.Initial });
    }
  });

  const handleTransferPasswordSubmit = useLastCallback((password: string) => {
    submitDappTransferPassword({ password });
  });

  const handleLedgerConnect = useLastCallback(() => {
    submitDappTransferHardware();
  });

  const handleResetTransfer = useLastCallback(() => {
    cancelDappTransfer();
    updateNextKey();
  });

  function renderSubTransaction() {
    const transaction = viewTransactionOnIdx !== undefined ? transactions?.[viewTransactionOnIdx] : undefined;

    return (
      <>
        <ModalHeader title={lang('Transaction Info')} onClose={closeDappTransfer} />
        <div className={modalStyles.transitionContent}>
          {Boolean(transaction) && (
            <DappTransfer
              transaction={transaction}
              tokensBySlug={tokensBySlug}
            />
          )}
          <div className={buildClassName(modalStyles.buttons, styles.buttonsAfterFee)}>
            <Button onClick={handleBackClick}>{lang('Back')}</Button>
          </div>
        </div>
      </>
    );
  }

  function renderPassword(isActive: boolean) {
    return (
      <>
        {!getDoesUsePinPad() && (
          <ModalHeader title={lang('Confirm Action')} onClose={closeDappTransfer} />
        )}
        <PasswordForm
          isActive={isActive}
          isLoading={isLoading}
          error={error}
          withCloseButton={IS_CAPACITOR}
          submitLabel={lang('Send')}
          cancelLabel={lang('Back')}
          onSubmit={handleTransferPasswordSubmit}
          onCancel={handleBackClick}
          onUpdate={clearDappTransferError}
        />
      </>
    );
  }

  function renderWaitForConnection() {
    const renderRow = (isLarge?: boolean) => (
      <div className={buildClassName(styles.rowContainerSkeleton, isLarge && styles.rowContainerLargeSkeleton)}>
        <div className={buildClassName(styles.rowTextSkeleton, isLarge && styles.rowTextLargeSkeleton)} />
        <div className={buildClassName(styles.rowSkeleton, isLarge && styles.rowLargeSkeleton)} />
      </div>
    );

    return (
      <>
        <ModalHeader title={lang('Send Transaction')} onClose={closeDappTransfer} />
        <div className={modalStyles.transitionContent}>
          <div className={styles.transactionDirection}>
            <div className={styles.transactionDirectionLeftSkeleton}>
              <div className={buildClassName(styles.nameSkeleton, styles.nameDappSkeleton)} />
              <div className={buildClassName(styles.descSkeleton, styles.descDappSkeleton)} />
            </div>
            <div className={styles.transactionDirectionRightSkeleton}>
              <div className={buildClassName(styles.dappInfoIconSkeleton, styles.transactionDappIconSkeleton)} />
              <div className={styles.dappInfoDataSkeleton}>
                <div className={buildClassName(styles.nameSkeleton, styles.nameDappSkeleton)} />
                <div className={buildClassName(styles.descSkeleton, styles.descDappSkeleton)} />
              </div>
            </div>
          </div>
          {renderRow(true)}
          {renderRow()}
          {renderRow()}
        </div>
      </>
    );
  }

  function renderTransferInitialWithSkeleton() {
    return (
      <Transition name="semiFade" activeKey={isDappLoading ? 0 : 1} slideClassName={styles.skeletonTransitionWrapper}>
        {isDappLoading ? renderWaitForConnection() : (
          <>
            <ModalHeader
              title={lang(isNftTransferPayload(renderingTransactions?.[0].payload) ? 'Send NFT' : 'Send Transaction')}
              onClose={closeDappTransfer}
            />
            <DappTransferInitial onClose={closeDappTransfer} />
          </>
        )}
      </Transition>
    );
  }

  // eslint-disable-next-line consistent-return
  function renderContent(isActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case TransferState.Initial:
        return renderTransferInitialWithSkeleton();
      case TransferState.WarningHardware:
        return (
          <>
            <ModalHeader title={lang('Send Transaction')} onClose={closeDappTransfer} />
            <DappLedgerWarning />
          </>
        );
      case TransferState.Confirm:
        return renderSubTransaction();
      case TransferState.Password:
        return renderPassword(isActive);
      case TransferState.ConnectHardware:
        return (
          <LedgerConnect
            isActive={isActive}
            state={hardwareState}
            isTonAppConnected={isTonAppConnected}
            isLedgerConnected={isLedgerConnected}
            onConnected={handleLedgerConnect}
            onClose={closeDappTransfer}
          />
        );
      case TransferState.ConfirmHardware:
        return (
          <LedgerConfirmOperation
            text={lang('Please confirm transaction on your Ledger')}
            error={error}
            onTryAgain={submitDappTransferHardware}
            onClose={closeDappTransfer}
          />
        );
    }
  }

  return (
    <Modal
      hasCloseButton
      isOpen={isOpen && !isMediaViewerOpen}
      noBackdropClose
      dialogClassName={buildClassName(styles.modalDialog, needsExtraHeight && styles.modalDialogExtraHeight)}
      nativeBottomSheetKey="dapp-transfer"
      forceFullNative={needsExtraHeight || renderingKey === TransferState.Password}
      onClose={closeDappTransfer}
      onCloseAnimationEnd={handleResetTransfer}
    >
      <Transition
        name={resolveSlideTransitionName()}
        className={buildClassName(modalStyles.transition, 'custom-scroll')}
        slideClassName={modalStyles.transitionSlide}
        activeKey={renderingKey}
        nextKey={nextKey}
        onStop={updateNextKey}
      >
        {renderContent}
      </Transition>
    </Modal>
  );
}

export default memo(withGlobal((global): StateProps => {
  const {
    hardwareState,
    isLedgerConnected,
    isTonAppConnected,
  } = global.hardware;
  const { isDangerous } = selectCurrentDappTransferTotals(global);

  return {
    currentDappTransfer: global.currentDappTransfer,
    tokensBySlug: global.tokenInfo.bySlug,
    hardwareState,
    isLedgerConnected,
    isTonAppConnected,
    isMediaViewerOpen: Boolean(global.mediaViewer.mediaId),
    isDangerous,
  };
})(DappTransferModal));
