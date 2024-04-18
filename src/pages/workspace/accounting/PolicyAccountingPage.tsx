import React, {useMemo, useRef, useState} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {withOnyx} from 'react-native-onyx';
import type {OnyxEntry} from 'react-native-onyx';
import CollapsibleSection from '@components/CollapsibleSection';
import ConfirmModal from '@components/ConfirmModal';
import ConnectToQuickbooksOnlineButton from '@components/ConnectToQuickbooksOnlineButton';
import ConnectToXeroButton from '@components/ConnectToXeroButton';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import * as Expensicons from '@components/Icon/Expensicons';
import * as Illustrations from '@components/Icon/Illustrations';
import type {MenuItemProps} from '@components/MenuItem';
import MenuItem from '@components/MenuItem';
import MenuItemList from '@components/MenuItemList';
import ScreenWrapper from '@components/ScreenWrapper';
import ScrollView from '@components/ScrollView';
import Section from '@components/Section';
import ThreeDotsMenu from '@components/ThreeDotsMenu';
import type ThreeDotsMenuProps from '@components/ThreeDotsMenu/types';
import useEnvironment from '@hooks/useEnvironment';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import {removePolicyConnection} from '@libs/actions/connections';
import Navigation from '@navigation/Navigation';
import AdminPolicyAccessOrNotFoundWrapper from '@pages/workspace/AdminPolicyAccessOrNotFoundWrapper';
import FeatureEnabledAccessOrNotFoundWrapper from '@pages/workspace/FeatureEnabledAccessOrNotFoundWrapper';
import PaidPolicyAccessOrNotFoundWrapper from '@pages/workspace/PaidPolicyAccessOrNotFoundWrapper';
import type {WithPolicyProps} from '@pages/workspace/withPolicy';
import withPolicyConnections from '@pages/workspace/withPolicyConnections';
import type {AnchorPosition} from '@styles/index';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {Policy, PolicyConnectionSyncProgress} from '@src/types/onyx';
import type {ConnectionName} from '@src/types/onyx/Policy';
import {isEmptyObject} from '@src/types/utils/EmptyObject';

type PolicyAccountingPageOnyxProps = {
    connectionSyncProgress: OnyxEntry<PolicyConnectionSyncProgress>;
};

type PolicyAccountingPageProps = WithPolicyProps &
    PolicyAccountingPageOnyxProps & {
        // This is not using OnyxEntry<OnyxTypes.Policy> because the HOC withPolicyConnections will only render this component if there is a policy
        policy: Policy;
    };

const accountingIntegrations = Object.values(CONST.POLICY.CONNECTIONS.NAME);

function connectToAccountingIntegrationButton(integrationToConnect: ConnectionName, policyID: string, environmentURL: string, isConnectedToIntegration: boolean) {
    // eslint-disable-next-line default-case
    switch (integrationToConnect) {
        case CONST.POLICY.CONNECTIONS.NAME.QBO:
            return (
                <ConnectToQuickbooksOnlineButton
                    policyID={policyID}
                    environmentURL={environmentURL}
                    disconnectIntegrationBeforeConnecting={isConnectedToIntegration}
                    integrationToConnect={integrationToConnect}
                />
            );
        case CONST.POLICY.CONNECTIONS.NAME.XERO:
            return (
                <ConnectToXeroButton
                    policyID={policyID}
                    environmentURL={environmentURL}
                    disconnectIntegrationBeforeConnecting={isConnectedToIntegration}
                    integrationToConnect={integrationToConnect}
                />
            );
    }
}

function accountingIntegrationIcon(connectionName: ConnectionName) {
    // eslint-disable-next-line default-case
    switch (connectionName) {
        case CONST.POLICY.CONNECTIONS.NAME.QBO:
            return Expensicons.QBOSquare;
        case CONST.POLICY.CONNECTIONS.NAME.XERO:
            return Expensicons.XeroSquare;
    }
}

function accountingIntegrationTitleKey(connectionName: ConnectionName) {
    // eslint-disable-next-line default-case
    switch (connectionName) {
        case CONST.POLICY.CONNECTIONS.NAME.QBO:
            return 'workspace.accounting.qbo';
        case CONST.POLICY.CONNECTIONS.NAME.XERO:
            return 'workspace.accounting.xero';
    }
}

function PolicyAccountingPage({policy, connectionSyncProgress}: PolicyAccountingPageProps) {
    const theme = useTheme();
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const {environmentURL} = useEnvironment();
    const {isSmallScreenWidth, windowWidth} = useWindowDimensions();
    const [threeDotsMenuPosition, setThreeDotsMenuPosition] = useState<AnchorPosition>({horizontal: 0, vertical: 0});
    const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
    const threeDotsMenuContainerRef = useRef<View>(null);

    const isSyncInProgress = !!connectionSyncProgress?.stageInProgress && connectionSyncProgress.stageInProgress !== CONST.POLICY.CONNECTIONS.SYNC_STAGE_NAME.JOB_DONE;
    const connectedIntegration = accountingIntegrations.find((integration) => !!policy?.connections?.[integration]);
    const policyID = policy?.id ?? '';

    const overflowMenu: ThreeDotsMenuProps['menuItems'] = useMemo(
        () => [
            {
                icon: Expensicons.Sync,
                text: translate('workspace.accounting.syncNow'),
                onSelected: () => {},
            },
            {
                icon: Expensicons.Trashcan,
                text: translate('workspace.accounting.disconnect'),
                onSelected: () => setIsDisconnectModalOpen(true),
            },
        ],
        [translate],
    );

    const connectionsMenuItems: MenuItemProps[] = useMemo(() => {
        if (isEmptyObject(policy?.connections) && !isSyncInProgress) {
            return accountingIntegrations.map((integration) => ({
                icon: accountingIntegrationIcon(integration),
                iconType: 'avatar',
                interactive: false,
                wrapperStyle: [styles.sectionMenuItemTopDescription],
                shouldShowRightComponent: true,
                title: translate(accountingIntegrationTitleKey(integration)),
                rightComponent: connectToAccountingIntegrationButton(integration, policyID, environmentURL, false),
            }));
        }

        return [
            {
                icon: accountingIntegrationIcon(connectedIntegration ?? connectionSyncProgress?.connectionName),
                iconType: 'avatar',
                interactive: false,
                wrapperStyle: [styles.sectionMenuItemTopDescription],
                shouldShowRightComponent: true,
                title: translate(accountingIntegrationTitleKey(connectedIntegration ?? connectionSyncProgress?.connectionName)),
                description: isSyncInProgress
                    ? translate('workspace.accounting.connections.syncStageName', connectionSyncProgress.stageInProgress)
                    : translate('workspace.accounting.lastSync'),
                rightComponent: isSyncInProgress ? (
                    <ActivityIndicator
                        style={[styles.popoverMenuIcon]}
                        color={theme.spinner}
                    />
                ) : (
                    <View ref={threeDotsMenuContainerRef}>
                        <ThreeDotsMenu
                            onIconPress={() => {
                                threeDotsMenuContainerRef.current?.measureInWindow((x, y, width, height) => {
                                    setThreeDotsMenuPosition({
                                        horizontal: x + width,
                                        vertical: y + height,
                                    });
                                });
                            }}
                            menuItems={overflowMenu}
                            anchorPosition={threeDotsMenuPosition}
                            anchorAlignment={{horizontal: CONST.MODAL.ANCHOR_ORIGIN_HORIZONTAL.RIGHT, vertical: CONST.MODAL.ANCHOR_ORIGIN_VERTICAL.TOP}}
                        />
                    </View>
                ),
            },
            ...(connectedIntegration
                ? [
                      {
                          icon: Expensicons.Pencil,
                          iconRight: Expensicons.ArrowRight,
                          shouldShowRightIcon: true,
                          title: translate('workspace.accounting.import'),
                          wrapperStyle: [styles.sectionMenuItemTopDescription],
                          onPress: () => Navigation.navigate(ROUTES.POLICY_ACCOUNTING_QUICKBOOKS_ONLINE_IMPORT.getRoute(policyID)),
                      },
                      {
                          icon: Expensicons.Send,
                          iconRight: Expensicons.ArrowRight,
                          shouldShowRightIcon: true,
                          title: translate('workspace.accounting.export'),
                          wrapperStyle: [styles.sectionMenuItemTopDescription],
                          onPress: () => {},
                      },
                      {
                          icon: Expensicons.Gear,
                          iconRight: Expensicons.ArrowRight,
                          shouldShowRightIcon: true,
                          title: translate('workspace.accounting.advanced'),
                          wrapperStyle: [styles.sectionMenuItemTopDescription],
                          onPress: () => {},
                      },
                  ]
                : []),
        ];
    }, [
        connectedIntegration,
        connectionSyncProgress?.connectionName,
        connectionSyncProgress?.stageInProgress,
        environmentURL,
        isSyncInProgress,
        overflowMenu,
        policy?.connections,
        policyID,
        styles.popoverMenuIcon,
        styles.sectionMenuItemTopDescription,
        theme.spinner,
        threeDotsMenuPosition,
        translate,
    ]);

    const otherIntegrationsItems = useMemo(() => {
        if (isEmptyObject(policy?.connections) && !isSyncInProgress) {
            return;
        }
        const otherIntegrations = accountingIntegrations.filter(
            (integration) => (isSyncInProgress && integration !== connectionSyncProgress?.connectionName) || integration !== connectedIntegration,
        );
        return otherIntegrations.map((integration) => ({
            icon: accountingIntegrationIcon(integration),
            title: translate(accountingIntegrationTitleKey(integration)),
            rightComponent: connectToAccountingIntegrationButton(integration, policyID, environmentURL, true),
        }));
    }, [connectedIntegration, connectionSyncProgress, environmentURL, isSyncInProgress, policy?.connections, policyID, translate]);

    const headerThreeDotsMenuItems: ThreeDotsMenuProps['menuItems'] = [
        {
            icon: Expensicons.Key,
            shouldShowRightIcon: true,
            iconRight: Expensicons.NewWindow,
            text: translate('workspace.accounting.enterCredentials'),
            onSelected: () => {},
        },
        {
            icon: Expensicons.Trashcan,
            text: translate('workspace.accounting.disconnect'),
            onSelected: () => setIsDisconnectModalOpen(true),
        },
    ];

    return (
        <AdminPolicyAccessOrNotFoundWrapper policyID={policyID}>
            <PaidPolicyAccessOrNotFoundWrapper policyID={policyID}>
                <FeatureEnabledAccessOrNotFoundWrapper
                    policyID={policyID}
                    featureName={CONST.POLICY.MORE_FEATURES.ARE_CONNECTIONS_ENABLED}
                >
                    <ScreenWrapper
                        testID={PolicyAccountingPage.displayName}
                        includeSafeAreaPaddingBottom={false}
                        shouldShowOfflineIndicatorInWideScreen
                    >
                        <HeaderWithBackButton
                            title={translate('workspace.common.accounting')}
                            shouldShowBackButton={isSmallScreenWidth}
                            icon={Illustrations.Accounting}
                            shouldShowThreeDotsButton
                            threeDotsAnchorPosition={styles.threeDotsPopoverOffsetNoCloseButton(windowWidth)}
                            threeDotsMenuItems={headerThreeDotsMenuItems}
                        />
                        <ScrollView contentContainerStyle={styles.pt3}>
                            <View style={[styles.flex1, isSmallScreenWidth ? styles.workspaceSectionMobile : styles.workspaceSection]}>
                                <Section
                                    title={translate('workspace.accounting.title')}
                                    subtitle={translate('workspace.accounting.subtitle')}
                                    isCentralPane
                                    subtitleMuted
                                    titleStyles={styles.accountSettingsSectionTitle}
                                    childrenStyles={styles.pt5}
                                >
                                    <MenuItemList
                                        menuItems={connectionsMenuItems}
                                        shouldUseSingleExecution
                                    />
                                    {!!otherIntegrationsItems?.length && otherIntegrationsItems?.length > 0 && (
                                        <CollapsibleSection
                                            title="Other integrations"
                                            wrapperStyle={styles.pr3}
                                            titleStyle={[styles.textNormal, styles.colorMuted]}
                                        >
                                            {otherIntegrationsItems.map((integration) => (
                                                <MenuItem
                                                    icon={integration.icon}
                                                    iconType="avatar"
                                                    interactive={false}
                                                    shouldShowRightComponent
                                                    wrapperStyle={styles.sectionMenuItemTopDescription}
                                                    title={integration.title}
                                                    rightComponent={integration.rightComponent}
                                                />
                                            ))}
                                        </CollapsibleSection>
                                    )}
                                </Section>
                            </View>
                        </ScrollView>
                        <ConfirmModal
                            title={translate('workspace.accounting.disconnectTitle')}
                            isVisible={isDisconnectModalOpen}
                            onConfirm={() => {
                                removePolicyConnection(policyID, CONST.POLICY.CONNECTIONS.NAME.QBO);
                                setIsDisconnectModalOpen(false);
                            }}
                            onCancel={() => setIsDisconnectModalOpen(false)}
                            prompt={translate('workspace.accounting.disconnectPrompt')}
                            confirmText={translate('workspace.accounting.disconnect')}
                            cancelText={translate('common.cancel')}
                            danger
                        />
                    </ScreenWrapper>
                </FeatureEnabledAccessOrNotFoundWrapper>
            </PaidPolicyAccessOrNotFoundWrapper>
        </AdminPolicyAccessOrNotFoundWrapper>
    );
}

PolicyAccountingPage.displayName = 'PolicyAccountingPage';

export default withPolicyConnections(
    withOnyx<PolicyAccountingPageProps, PolicyAccountingPageOnyxProps>({
        connectionSyncProgress: {
            key: (props) => `${ONYXKEYS.COLLECTION.POLICY_CONNECTION_SYNC_PROGRESS}${props.route.params.policyID}`,
        },
    })(PolicyAccountingPage),
);
