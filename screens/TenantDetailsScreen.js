// screens/TenantDetailsScreen.js
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal, TextInput, InteractionManager, Animated, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { WebView } from 'react-native-webview';
import { useIsFocused } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { fetchTenantBillingSummary } from '../lib/financesService';
import { fetchActiveContractByTenant, endContract } from '../lib/contractsService';
import { colors, radii, typography } from '../theme';
import { useAccessibilityTheme } from '../lib/useAccessibilityTheme';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { Buffer } from 'buffer';
import { fetchTenantDocuments, uploadTenantDocument, deleteTenantDocument, DOCUMENT_TYPES } from '../lib/tenantDocumentsService';
import { filterOnlyNumbers } from '../lib/validation';
import { canViewTenantDetails, getUserSubscription, getActiveTenantsCount, getRequiredPlan, canAddDocument, getTotalDocumentsCount } from '../lib/subscriptionService';
import UpgradeModal from '../components/UpgradeModal';
import { TenantDetailsSkeleton } from '../components/SkeletonLoader';

// Função para formatar valor monetário
const formatCurrency = (value) => {
  if (!value && value !== 0) return 'R$ 0,00';
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}`;
};

const createStyles = (theme) => StyleSheet.create({
  blockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  blockedTitle: {
    ...theme.typography.sectionTitle,
    marginTop: 20,
    marginBottom: 12,
  },
  blockedMessage: {
    ...theme.typography.body,
    textAlign: 'center',
    marginBottom: 8,
  },
  blockedSubMessage: {
    ...theme.typography.body,
    textAlign: 'center',
    color: theme.colors.textSecondary,
    marginBottom: 24,
  },
  upgradeButtonBlocked: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: theme.radii.pill,
  },
  upgradeButtonTextBlocked: {
    ...theme.typography.button,
    color: theme.colors.surface,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  avatarContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  avatarTouchable: {
    position: 'relative',
    marginBottom: 15,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarEditIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 6,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: 15,
    marginHorizontal: 15,
    marginTop: 20,
    ...(theme.isHighContrast && {
      borderWidth: 2,
      borderColor: theme.colors.textPrimary,
      elevation: 0,
    }),
  },
  sectionTitle: {
    ...theme.typography.sectionTitle,
    marginBottom: 15,
  },
  contractPropertyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0f7ff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    ...(theme.isHighContrast && {
      borderWidth: 2,
      borderColor: theme.colors.textPrimary,
      backgroundColor: theme.colors.surface,
    }),
  },
  contractPropertyInfo: {
    flex: 1,
    marginRight: 8,
  },
  contractPropertyAddress: {
    ...theme.typography.bodyStrong,
    marginBottom: 4,
  },
  contractPropertySub: {
    ...theme.typography.body,
  },
  contractPropertyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radii.pill,
    backgroundColor: '#ffebee',
  },
  contractPropertyActionText: {
    marginLeft: 4,
    color: '#F44336',
    fontWeight: '600',
  },
  contractPropertyEmpty: {
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#f5f5f5',
    marginBottom: 12,
  },
  contractPropertyEmptyText: {
    ...theme.typography.body,
    color: '#777',
    fontStyle: 'italic',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  infoLabel: {
    ...theme.typography.bodyStrong,
  },
  infoValue: {
    ...theme.typography.body,
    flex: 1,
    textAlign: 'right',
  },
  linkText: {
    color: '#4a86e8',
    textDecorationLine: 'underline',
  },
  buttonContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    padding: 15,
    gap: 8,
    marginBottom: 20,
  },
  editButton: {
    backgroundColor: 'transparent',
    padding: 15,
    borderRadius: theme.radii.pill,
    flex: 1,
    alignItems: 'center',
    borderWidth: 0,
  },
  deleteButton: {
    backgroundColor: 'transparent',
    padding: 15,
    borderRadius: theme.radii.pill,
    flex: 1,
    alignItems: 'center',
  },
  buttonText: {
    ...theme.typography.button,
    color: '#fff',
  },
  editButtonText: {
    ...theme.typography.button,
    color: theme.colors.primary,
  },
  deleteButtonText: {
    color: theme.colors.expense,
  },
  tenantActions: {
    marginTop: 10,
  },
  tenantActionButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    alignItems: 'center',
  },
  tenantActionText: {
    ...theme.typography.button,
    color: theme.colors.primary,
  },
  primaryContractButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  primaryContractButtonText: {
    ...theme.typography.button,
    color: '#fff',
  },
  timelineTitle: {
    ...theme.typography.caption,
    marginTop: 10,
    fontWeight: '600',
    color: '#555',
  },
  timelineContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 4,
  },
  timelinePill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  timelinePillPaid: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  timelinePillOverdue: {
    backgroundColor: '#FFEBEE',
    borderColor: '#F44336',
  },
  timelinePillDueSoon: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9800',
  },
  timelinePillText: {
    ...theme.typography.caption,
    color: '#666',
  },
  timelinePillTextEmphasis: {
    fontWeight: '600',
    color: '#333',
  },
  timelineLegend: {
    flexDirection: 'row',
    marginTop: 8,
    justifyContent: 'space-between',
  },
  timelineLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 4,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  legendDotPaid: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  legendDotOverdue: {
    backgroundColor: '#F44336',
    borderColor: '#F44336',
  },
  legendDotDueSoon: {
    backgroundColor: '#FF9800',
    borderColor: '#FF9800',
  },
  legendDotFuture: {
    backgroundColor: '#ddd',
  },
  legendText: {
    ...theme.typography.caption,
    color: '#555',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  phoneActions: {
    flexDirection: 'row',
    marginLeft: 10,
    gap: 8,
  },
  phoneActionButton: {
    padding: 8,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primarySoft,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  addDocumentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primarySoft || '#f0f7ff',
    gap: 4,
    ...(theme.isHighContrast && {
      backgroundColor: theme.colors.surface,
      borderWidth: 2,
      borderColor: theme.colors.textPrimary,
    }),
  },
  addDocumentButtonText: {
    ...theme.typography.button,
    color: theme.isHighContrast ? theme.colors.textPrimary : theme.colors.primary,
  },
  documentsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 10,
  },
  documentsLoadingText: {
    color: '#666',
    fontSize: 14,
  },
  documentsEmpty: {
    alignItems: 'center',
    padding: 30,
  },
  documentsEmptyText: {
    ...theme.typography.body,
    marginTop: 10,
    color: '#999',
  },
  documentsList: {
    gap: 8,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    ...(theme.isHighContrast && {
      borderWidth: 2,
      borderColor: theme.colors.textPrimary,
    }),
  },
  documentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  documentDetails: {
    flex: 1,
    marginLeft: 12,
  },
  documentName: {
    ...theme.typography.bodyStrong,
    marginBottom: 2,
  },
  documentMeta: {
    ...theme.typography.caption,
    color: '#666',
  },
  documentActions: {
    flexDirection: 'row',
    gap: 8,
  },
  documentActionButton: {
    padding: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: theme.radii.lg,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    ...theme.typography.sectionTitle,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  documentTypeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
    minHeight: 56,
  },
  documentTypeOptionText: {
    ...theme.typography.body,
  },
  modalLabel: {
    ...theme.typography.bodyStrong,
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    color: theme.colors.textPrimary,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f0f0f0',
  },
  modalButtonConfirm: {
    backgroundColor: theme.colors.primary,
  },
  modalButtonCancelText: {
    ...theme.typography.button,
    color: '#333',
  },
  modalButtonConfirmText: {
    ...theme.typography.button,
    color: '#fff',
  },
  customNameModalContent: {
    marginBottom: 52,
  },
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheetContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ccc',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  bottomSheetTitle: {
    ...theme.typography.sectionTitle,
    flex: 1,
  },
  bottomSheetCloseButton: {
    padding: 4,
    marginLeft: 10,
  },
  bottomSheetBody: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  documentTypeOptionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  documentTypeOptionDisabled: {
    opacity: 0.6,
    backgroundColor: '#f5f5f5',
  },
  documentTypeOptionTextDisabled: {
    color: '#999',
  },
  documentExistsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  documentExistsText: {
    ...theme.typography.caption,
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 4,
  },
  documentCountBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  documentCountText: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  documentViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentViewerContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: '#000',
  },
  documentViewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  documentViewerTitle: {
    ...theme.typography.sectionTitle,
    color: '#fff',
    flex: 1,
    marginRight: 12,
  },
  documentViewerCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  documentViewerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentViewerLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  documentViewerLoadingText: {
    ...theme.typography.body,
    color: '#fff',
    marginTop: 12,
  },
  documentImageContainer: {
    flex: 1,
    width: '100%',
  },
  documentImageContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height - 150,
  },
  documentPdfContainer: {
    flex: 1,
    width: '100%',
  },
  documentPdfWebView: {
    flex: 1,
    backgroundColor: '#fff',
  },
  documentViewerUnsupported: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  documentViewerUnsupportedText: {
    ...theme.typography.body,
    color: '#fff',
    marginTop: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  documentViewerOpenButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: theme.radii.pill,
  },
  documentViewerOpenButtonText: {
    ...theme.typography.button,
    color: '#fff',
    fontWeight: '600',
  },
});

const TenantDetailsScreen = ({ route, navigation }) => {
  const { tenant: initialTenant } = route.params;
  const { theme: accessibilityTheme, isLoading: themeLoading } = useAccessibilityTheme();

  // Usa tema de acessibilidade se disponível, senão usa tema padrão
  const theme = accessibilityTheme || { colors, radii, typography };




  const styles = useMemo(() => createStyles(theme), [theme]);

  const [tenant, setTenant] = useState(initialTenant);
  const [loading, setLoading] = useState(true);
  const [billingSummary, setBillingSummary] = useState({
    expected: 0,
    paid: 0,
    overdue: 0,
  });
  const [billingSchedule, setBillingSchedule] = useState([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [contract, setContract] = useState(null);
  const [contractLoading, setContractLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [showDocumentTypeModal, setShowDocumentTypeModal] = useState(false);
  const [showCustomNameModal, setShowCustomNameModal] = useState(false);
  const [customDocumentName, setCustomDocumentName] = useState('');
  const [selectedDocumentType, setSelectedDocumentType] = useState(null);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const documentTypeRef = useRef(null);
  const isFocused = useIsFocused();
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;

  // Função para decodificar base64
  const decode = (base64) => {
    const binaryString = Buffer.from(base64, 'base64').toString('binary');
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  // Resetar animação quando o modal fecha
  useEffect(() => {
    if (!showDocumentTypeModal) {
      slideAnim.setValue(Dimensions.get('window').height);
    }
  }, [showDocumentTypeModal]);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!initialTenant?.id) return;

      setLoading(true);

      // Verificar se o inquilino está bloqueado
      // IMPORTANTE: Re-verifica quando a tela é focada novamente (ex: após upgrade de plano)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const canView = await canViewTenantDetails(user.id, initialTenant.id);
        if (!canView) {
          setIsBlocked(true);
          const tenantCount = await getActiveTenantsCount(user.id);
          const subscription = await getUserSubscription(user.id);
          const currentPlan = subscription?.subscription_plan || 'free';
          // Se o plano atual é basic, sempre sugere premium
          const requiredPlan = currentPlan === 'basic' ? 'premium' : getRequiredPlan(tenantCount);

          setSubscriptionInfo({
            currentPlan,
            tenantCount,
            requiredPlan,
          });
          setLoading(false);
          return;
        } else {
          // Se antes estava bloqueado e agora pode ver, desbloqueia
          setIsBlocked(false);
        }
      }

      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select(`
          *,
          properties (
            id,
            address,
            rent 
          )
        `)
        .eq('id', initialTenant.id)
        .single();

      if (tenantError) {
        setLoading(false);
        Alert.alert('Erro', 'Não foi possível buscar os detalhes do inquilino.');
        console.error('Error fetching details:', tenantError);
        return;
      }

      setTenant(tenantData);
      setLoading(false);
    };

    // Recarregar dados sempre que a tela receber foco
    if (isFocused) {
      fetchDetails();
    }
  }, [isFocused, initialTenant?.id]);

  useEffect(() => {
    const loadContract = async () => {
      if (!tenant?.id) return;
      setContractLoading(true);
      try {
        const { data } = await fetchActiveContractByTenant(tenant.id);
        setContract(data || null);
      } finally {
        setContractLoading(false);
      }
    };

    loadContract();
  }, [tenant?.id, isFocused]);

  useEffect(() => {
    const loadBilling = async () => {
      // Se não há contrato ativo, não há mensalidades a exibir
      if (!contract) {
        setBillingSummary({ expected: 0, paid: 0, overdue: 0 });
        setBillingSchedule([]);
        return;
      }

      setBillingLoading(true);
      try {
        // Monta um objeto compatível com a função de billing atual,
        // usando os dados do contrato (e não mais do cadastro do inquilino)
        const source = {
          property_id: contract.property_id,
          tenant_id: contract.tenant_id,
          start_date: contract.start_date,
          due_date: contract.due_day,
          lease_term: contract.lease_term,
        };

        const { summary, schedule } = await fetchTenantBillingSummary(source);
        setBillingSummary(summary);
        setBillingSchedule(schedule);
      } finally {
        setBillingLoading(false);
      }
    };

    loadBilling();
  }, [contract, isFocused]);

  useEffect(() => {
    const loadDocuments = async () => {
      if (!tenant?.id) return;
      setDocumentsLoading(true);
      try {
        const { data, error } = await fetchTenantDocuments(tenant.id);
        if (error) {
          console.error('Erro ao carregar documentos:', error);
        } else {
          setDocuments(data || []);
        }
      } finally {
        setDocumentsLoading(false);
      }
    };

    loadDocuments();
  }, [tenant?.id, isFocused]);

  const handleDeleteTenant = async () => {
    Alert.alert(
      "Confirmar Exclusão",
      "Você tem certeza que quer deletar este inquilino?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Deletar",
          onPress: async () => {
            // 1) Limpar lançamentos financeiros de aluguel (receitas) ligados a este inquilino
            const { error: financesError } = await supabase
              .from('finances')
              .delete()
              .eq('tenant_id', tenant.id)
              .eq('type', 'income');

            if (financesError) {
              console.error('Erro ao limpar lançamentos financeiros do inquilino:', financesError);
              Alert.alert(
                'Erro',
                'Não foi possível limpar os registros de pagamentos de aluguel deste inquilino. Tente novamente.'
              );
              return;
            }

            // 2) Deletar o inquilino (contratos são removidos automaticamente via ON DELETE CASCADE)
            const { error } = await supabase.from('tenants').delete().eq('id', tenant.id);
            if (error) {
              Alert.alert('Erro', 'Não foi possível deletar o inquilino.');
            } else {
              Alert.alert('Sucesso', 'Inquilino deletado e registros financeiros de aluguel limpos.');
              navigation.goBack();
            }
          },
          style: 'destructive'
        }
      ]
    );
  };

  const handleEndTenancy = async () => {
    Alert.alert(
      'Encerrar locação',
      'Tem certeza que deseja encerrar a locação deste inquilino para este imóvel?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Encerrar',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('tenants')
              .update({ property_id: null })
              .eq('id', tenant.id);

            if (error) {
              console.error('Erro ao encerrar locação pelo inquilino:', error);
              Alert.alert('Erro', 'Não foi possível encerrar a locação.');
              return;
            }

            // Encerrar contrato ativo associado, se existir
            if (contract?.id) {
              const { error: contractError } = await endContract(contract.id);
              if (contractError) {
                console.error('Erro ao encerrar contrato ativo:', contractError);
              }
            }

            Alert.alert('Sucesso', 'Locação encerrada e imóvel desvinculado.');
            setTenant((prev) => ({
              ...prev,
              property_id: null,
              properties: null,
            }));
            setContract(null);
          },
        },
      ]
    );
  };

  const handleRegisterRentPayment = () => {
    if (!tenant.property_id) return;
    navigation.navigate('AddTransaction', {
      preselectedPropertyId: tenant.property_id,
      preselectedType: 'rent', // Tipo 'rent' para ativar o modo aluguel
      preselectedTenantId: tenant.id,
    });
  };

  const handlePhotoPicker = async (useCamera = false) => {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permission.status !== 'granted') {
      Alert.alert('Permissão necessária', 'Você precisa permitir o acesso para adicionar fotos.');
      return;
    }

    try {
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });

      if (!result) {
        Alert.alert('Erro', 'Não foi possível abrir o seletor de imagens.');
        return;
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await uploadTenantPhoto(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Erro', `Não foi possível abrir ${useCamera ? 'a câmera' : 'a galeria'}.`);
    }
  };

  const uploadTenantPhoto = async (asset) => {
    if (!tenant?.id) return;

    setUploadingPhoto(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert('Erro', 'Você precisa estar logado.');
      setUploadingPhoto(false);
      return;
    }

    try {
      // Fazer upload da nova foto
      const fileName = `${user.id}/${tenant.id}_${Date.now()}.jpg`;
      const bucketName = 'tenant-photos';

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, decode(asset.base64), { contentType: 'image/jpeg' });

      if (uploadError) {
        Alert.alert('Erro no Upload', uploadError.message);
        setUploadingPhoto(false);
        return;
      }

      // Obter URL pública
      const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(fileName);
      const photoUrl = urlData?.publicUrl;

      if (photoUrl) {
        // Remover foto antiga se existir (após upload bem-sucedido)
        if (tenant.photo_url) {
          try {
            const oldUrlParts = tenant.photo_url.split('/');
            const oldFileName = oldUrlParts[oldUrlParts.length - 1];
            const oldFilePath = oldUrlParts.slice(oldUrlParts.indexOf('tenant-photos') + 1).join('/');
            if (oldFilePath) {
              await supabase.storage
                .from('tenant-photos')
                .remove([oldFilePath]);
            }
          } catch (removeError) {
            console.warn('Erro ao remover foto antiga:', removeError);
            // Não bloquear o processo se falhar ao remover a foto antiga
          }
        }

        // Atualizar inquilino com a nova URL da foto
        const { error: updateError } = await supabase
          .from('tenants')
          .update({ photo_url: photoUrl })
          .eq('id', tenant.id);

        if (updateError) {
          Alert.alert('Erro', 'Não foi possível salvar a foto.');
        } else {
          // Atualizar estado local
          setTenant((prev) => ({ ...prev, photo_url: photoUrl }));
          Alert.alert('Sucesso', 'Foto atualizada com sucesso!');
        }
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível fazer upload da foto.');
      console.error('Erro ao fazer upload da foto:', error);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!tenant?.id || !tenant.photo_url) return;

    Alert.alert(
      'Remover foto',
      'Deseja realmente remover a foto do inquilino?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            setUploadingPhoto(true);
            const { data: { user } } = await supabase.auth.getUser();

            try {
              // Remover do storage
              const urlParts = tenant.photo_url.split('/');
              const filePath = urlParts.slice(urlParts.indexOf('tenant-photos') + 1).join('/');
              if (filePath) {
                await supabase.storage
                  .from('tenant-photos')
                  .remove([filePath]);
              }

              // Remover do banco
              const { error } = await supabase
                .from('tenants')
                .update({ photo_url: null })
                .eq('id', tenant.id);

              if (error) {
                Alert.alert('Erro', 'Não foi possível remover a foto.');
              } else {
                setTenant((prev) => ({ ...prev, photo_url: null }));
                Alert.alert('Sucesso', 'Foto removida com sucesso!');
              }
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível remover a foto.');
              console.error('Erro ao remover foto:', error);
            } finally {
              setUploadingPhoto(false);
            }
          },
        },
      ]
    );
  };

  if (loading || !tenant || themeLoading) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          title="Carregando..."
          onBack={() => navigation.goBack()}
        />
        <ScrollView style={styles.scrollContainer}>
          <TenantDetailsSkeleton />
        </ScrollView>
      </View>
    );
  }

  // Tela de bloqueio quando inquilino está bloqueado
  if (isBlocked) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          title={tenant.full_name}
          onBack={() => navigation.goBack()}
        />
        <View style={styles.blockedContainer}>
          <MaterialIcons name="lock" size={64} color={colors.textSecondary} />
          <Text style={styles.blockedTitle}>Acesso Bloqueado</Text>
          <Text style={styles.blockedMessage}>
            Este inquilino requer upgrade de plano para ser acessado.
          </Text>
          <Text style={styles.blockedSubMessage}>
            Você está usando {subscriptionInfo?.tenantCount || 0} {subscriptionInfo?.tenantCount === 1 ? 'inquilino' : 'inquilinos'}.
            Faça upgrade para acessar todos os seus inquilinos.
          </Text>
          <TouchableOpacity
            style={styles.upgradeButtonBlocked}
            onPress={() => setShowUpgradeModal(true)}
          >
            <Text style={styles.upgradeButtonTextBlocked}>Fazer Upgrade</Text>
          </TouchableOpacity>
        </View>

        <UpgradeModal
          visible={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          onUpgrade={() => {
            setShowUpgradeModal(false);
            navigation.navigate('Subscription');
          }}
          currentPlan={subscriptionInfo?.currentPlan || 'free'}
          propertyCount={subscriptionInfo?.propertyCount || subscriptionInfo?.tenantCount || 0}
          requiredPlan={subscriptionInfo?.requiredPlan || 'basic'}
          customMessage={subscriptionInfo?.customMessage}
        />
      </View>
    );
  }

  const handleOpenProperty = () => {
    if (!tenant.properties) return;
    navigation.navigate('PropertyDetails', { property: tenant.properties });
  };

  // Funções de comunicação
  const handleCall = () => {
    if (!tenant.phone) {
      Alert.alert('Aviso', 'Telefone não informado.');
      return;
    }
    const phoneNumber = filterOnlyNumbers(tenant.phone);
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleWhatsApp = () => {
    if (!tenant.phone) {
      Alert.alert('Aviso', 'Telefone não informado.');
      return;
    }
    const phoneNumber = filterOnlyNumbers(tenant.phone);
    // Formato: 5511999999999 (código do país + DDD + número)
    // Se não começar com 55, adiciona (assumindo Brasil)
    const formattedNumber = phoneNumber.startsWith('55') ? phoneNumber : `55${phoneNumber}`;
    Linking.openURL(`https://wa.me/${formattedNumber}`);
  };

  // Função para verificar se hoje é o dia de vencimento
  const isDueDateToday = () => {
    if (!contract?.due_day) return false;

    const today = new Date();
    const todayDay = today.getDate();
    const dueDay = contract.due_day;

    // Verifica se hoje é o dia de vencimento
    // Considera casos especiais (ex: dia 31 em meses com menos dias)
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const effectiveDueDay = Math.min(dueDay, lastDayOfMonth);

    return todayDay === effectiveDueDay;
  };

  // Função para verificar se o vencimento já passou
  const isDueDatePassed = () => {
    if (!contract?.due_day) return false;

    const today = new Date();
    const todayDay = today.getDate();
    const dueDay = contract.due_day;

    // Verifica se o dia de vencimento já passou este mês
    // Considera casos especiais (ex: dia 31 em meses com menos dias)
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const effectiveDueDay = Math.min(dueDay, lastDayOfMonth);

    return todayDay > effectiveDueDay;
  };

  // Função para cobrar aluguel via WhatsApp
  const handleRentReminder = () => {
    if (!tenant.phone) {
      Alert.alert('Aviso', 'Telefone não informado.');
      return;
    }

    if (!contract && !tenant.properties) {
      Alert.alert('Aviso', 'Não há informações de contrato ou propriedade.');
      return;
    }

    // Obtém valor do aluguel (prioridade: contract.rent_amount, fallback: property.rent)
    const rentAmount = contract?.rent_amount || tenant.properties?.rent || 0;
    const rentFormatted = formatCurrency(rentAmount);

    // Obtém nome do inquilino
    const tenantName = tenant.full_name || 'Inquilino';

    // Determina mensagem baseada na data
    let messageText;
    if (isDueDateToday()) {
      messageText = `Olá ${tenantName}, seu aluguel de ${rentFormatted} vence hoje (dia ${contract.due_day}).`;
    } else if (isDueDatePassed() || billingSummary.overdue > 0) {
      const today = new Date();
      const todayDay = today.getDate();
      const dueDay = contract?.due_day || 0;
      messageText = `Olá ${tenantName}, seu aluguel de ${rentFormatted} venceu dia ${dueDay}.`;
    } else {
      // Se ainda não chegou, usa mensagem genérica
      messageText = `Olá ${tenantName}, seu aluguel de ${rentFormatted} vence dia ${contract.due_day}.`;
    }

    // Formata número de telefone
    const phoneNumber = filterOnlyNumbers(tenant.phone);
    const formattedNumber = phoneNumber.startsWith('55') ? phoneNumber : `55${phoneNumber}`;

    // Codifica mensagem para URL
    const encodedMessage = encodeURIComponent(messageText);

    // Abre WhatsApp com mensagem pré-formatada
    Linking.openURL(`https://wa.me/${formattedNumber}?text=${encodedMessage}`);
  };

  // Funções de documentos
  const checkDocumentExists = (documentType, customName = null) => {
    if (documentType === 'outros' && customName) {
      // Para documentos "outros", verificar por custom_name
      return documents.some(
        doc => doc.document_type === 'outros' &&
          doc.custom_name &&
          doc.custom_name.toLowerCase().trim() === customName.toLowerCase().trim()
      );
    } else {
      // Para outros tipos, verificar por document_type
      return documents.some(doc => doc.document_type === documentType);
    }
  };

  // Conta quantos documentos "outros" já existem no total
  const countOtherDocuments = () => {
    return documents.filter(doc => doc.document_type === 'outros').length;
  };

  const handleSelectDocumentType = (documentType) => {
    console.log('handleSelectDocumentType chamado com:', documentType);

    // Para documentos "outros", verificar se já existem 3 ou mais
    if (documentType === 'outros') {
      const count = countOtherDocuments();
      if (count >= 3) {
        Alert.alert(
          'Limite atingido',
          'Já existem 3 documentos na categoria "Outros". Exclua um documento existente antes de adicionar um novo.',
          [{ text: 'OK' }]
        );
        return;
      }
    } else {
      // Para outros tipos, verificar se já existe um documento deste tipo
      if (checkDocumentExists(documentType)) {
        const documentTypeLabel = DOCUMENT_TYPES.find(t => t.key === documentType)?.label || documentType;
        Alert.alert(
          'Documento já existe',
          `Já existe um documento do tipo "${documentTypeLabel}" cadastrado. Exclua o documento existente antes de adicionar um novo.`,
          [{ text: 'OK' }]
        );
        return;
      }
    }

    // Salvar no ref para garantir que não seja perdido
    documentTypeRef.current = documentType;
    setSelectedDocumentType(documentType);
    handleCloseDocumentTypeModal();

    if (documentType === 'outros') {
      // Se for "outros", mostra modal para nome customizado
      // Pequeno delay para garantir que o modal anterior feche
      setTimeout(() => {
        setShowCustomNameModal(true);
      }, 300);
    } else {
      // Usar InteractionManager para garantir que o modal feche antes de abrir o picker
      InteractionManager.runAfterInteractions(() => {
        console.log('Chamando handleDocumentPicker com:', documentType);
        handleDocumentPicker(documentType);
      });
    }
  };

  const handleConfirmCustomName = () => {
    if (customDocumentName && customDocumentName.trim()) {
      const trimmedName = customDocumentName.trim();

      // Verificar quantos documentos "outros" já existem no total
      const count = countOtherDocuments();

      // Permitir até 3 documentos na categoria "outros" no total
      if (count >= 3) {
        Alert.alert(
          'Limite atingido',
          'Já existem 3 documentos na categoria "Outros". Exclua um documento existente antes de adicionar um novo.',
          [{ text: 'OK' }]
        );
        setCustomDocumentName('');
        return;
      }

      setCustomDocumentName(trimmedName);
      documentTypeRef.current = 'outros';
      setSelectedDocumentType('outros');
      setShowCustomNameModal(false);
      // Usar InteractionManager para garantir que o modal feche antes de abrir o picker
      InteractionManager.runAfterInteractions(() => {
        handleDocumentPicker('outros');
      });
    } else {
      Alert.alert('Aviso', 'Por favor, informe o nome do documento.');
    }
  };

  const handleAddDocument = () => {
    setShowDocumentTypeModal(true);
    // Animar o bottom sheet para cima
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const handleCloseDocumentTypeModal = () => {
    // Animar o bottom sheet para baixo
    Animated.timing(slideAnim, {
      toValue: Dimensions.get('window').height,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setShowDocumentTypeModal(false);
    });
  };

  const handleDocumentPicker = (documentType = null) => {
    // Usar o parâmetro, ref ou o estado (nesta ordem de prioridade)
    const typeToUse = documentType || documentTypeRef.current || selectedDocumentType;

    // Verificar se o tipo foi selecionado
    if (!typeToUse) {
      console.warn('Tipo de documento não selecionado');
      Alert.alert('Erro', 'Tipo de documento não selecionado. Tente novamente.');
      return;
    }

    // Garantir que o ref esteja atualizado
    documentTypeRef.current = typeToUse;

    // Abrir ActionSheet nativo para escolher entre câmera e galeria
    Alert.alert(
      'Escolha a origem',
      'Como deseja adicionar o documento?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
          onPress: () => {
            setSelectedDocumentType(null);
            documentTypeRef.current = null;
          },
        },
        {
          text: 'Tirar foto',
          onPress: () => handleImageSourceSelection(true),
        },
        {
          text: 'Escolher da galeria',
          onPress: () => handleImageSourceSelection(false),
        },
      ],
      { cancelable: true }
    );
  };

  const handleImageSourceSelection = async (useCamera) => {
    try {
      const typeToUse = documentTypeRef.current || selectedDocumentType;

      if (!typeToUse) {
        Alert.alert('Erro', 'Tipo de documento não selecionado. Tente novamente.');
        return;
      }

      // Solicitar permissão apropriada
      const permission = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert('Permissão necessária', 'Você precisa permitir o acesso para adicionar documentos.');
        setSelectedDocumentType(null);
        documentTypeRef.current = null;
        return;
      }

      // Abrir câmera ou galeria
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.8 });

      if (!result) {
        Alert.alert('Erro', 'Não foi possível abrir o seletor de imagens.');
        setSelectedDocumentType(null);
        documentTypeRef.current = null;
        return;
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileData = {
          fileName: asset.fileName || `documento_${Date.now()}.jpg`,
          mimeType: asset.mimeType || 'image/jpeg',
          fileSize: asset.fileSize || 0,
          base64: asset.base64,
        };

        await uploadDocument(fileData, typeToUse);
      } else if (!result.canceled && (!result.assets || result.assets.length === 0)) {
        Alert.alert('Erro', 'Não foi possível obter a imagem selecionada.');
        setSelectedDocumentType(null);
        documentTypeRef.current = null;
      } else {
        // Se o usuário cancelou, limpar o tipo selecionado
        setSelectedDocumentType(null);
        documentTypeRef.current = null;
      }
    } catch (error) {
      console.error('Erro no handleImageSourceSelection:', error);
      Alert.alert('Erro', `Ocorreu um erro ao abrir ${useCamera ? 'a câmera' : 'a galeria'}. Tente novamente.`);
      setSelectedDocumentType(null);
      documentTypeRef.current = null;
    }
  };

  const uploadDocument = async (fileData, documentType = null) => {
    const typeToUse = documentType || selectedDocumentType;
    if (!typeToUse) {
      Alert.alert('Erro', 'Tipo de documento não selecionado.');
      return;
    }

    // Verificar se pode adicionar mais documentos
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const canAdd = await canAddDocument(user.id);
      if (!canAdd) {
        const documentCount = await getTotalDocumentsCount(user.id);
        const subscription = await getUserSubscription(user.id);
        const currentPlan = subscription?.subscription_plan || 'free';
        // Se o plano atual é basic, sempre sugere premium
        const requiredPlan = currentPlan === 'basic' ? 'premium' : 'basic';

        setSubscriptionInfo({
          currentPlan,
          propertyCount: documentCount,
          requiredPlan,
          customMessage: `Você já possui ${documentCount} ${documentCount === 1 ? 'documento' : 'documentos'}. O plano Gratuito permite apenas 1 documento. Faça upgrade para adicionar mais documentos.`,
        });
        setShowUpgradeModal(true);
        setSelectedDocumentType(null);
        setCustomDocumentName('');
        return;
      }
    }

    setUploadingDocument(true);
    try {
      const { data, error } = await uploadTenantDocument(
        tenant.id,
        typeToUse,
        fileData,
        typeToUse === 'outros' ? customDocumentName : null
      );

      if (error) {
        Alert.alert('Erro', error.message || 'Não foi possível fazer upload do documento.');
      } else {
        Alert.alert('Sucesso', 'Documento adicionado com sucesso!');
        // Recarregar lista de documentos
        const { data: updatedDocuments } = await fetchTenantDocuments(tenant.id);
        setDocuments(updatedDocuments || []);
      }
    } catch (err) {
      console.error('Erro ao fazer upload:', err);
      Alert.alert('Erro', 'Ocorreu um erro inesperado.');
    } finally {
      setUploadingDocument(false);
      setSelectedDocumentType(null);
      setCustomDocumentName('');
    }
  };

  const handleDeleteDocument = (documentId) => {
    Alert.alert(
      'Confirmar exclusão',
      'Tem certeza que deseja excluir este documento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            const { error } = await deleteTenantDocument(documentId);
            if (error) {
              Alert.alert('Erro', 'Não foi possível excluir o documento.');
            } else {
              Alert.alert('Sucesso', 'Documento excluído com sucesso!');
              // Recarregar lista de documentos
              const { data: updatedDocuments } = await fetchTenantDocuments(tenant.id);
              setDocuments(updatedDocuments || []);
            }
          },
        },
      ]
    );
  };

  const handleViewDocument = (document) => {
    if (document.file_url) {
      setSelectedDocument(document);
      setShowDocumentViewer(true);
      setDocumentLoading(true);
    } else {
      Alert.alert('Erro', 'URL do documento não disponível.');
    }
  };

  const handleCloseDocumentViewer = () => {
    setShowDocumentViewer(false);
    setSelectedDocument(null);
    setDocumentLoading(false);
  };

  const getDocumentTypeLabel = (documentType, customName) => {
    if (documentType === 'outros' && customName) {
      return customName;
    }
    const type = DOCUMENT_TYPES.find((t) => t.key === documentType);
    return type ? type.label : documentType;
  };



  return (
    <View style={styles.container}>
      <ScreenHeader
        title={tenant.full_name}
        onBack={() => navigation.goBack()}
      />
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.avatarContainer}>
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Foto do Inquilino',
                'Escolha uma opção',
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Câmera', onPress: () => handlePhotoPicker(true) },
                  { text: 'Galeria', onPress: () => handlePhotoPicker(false) },
                  tenant.photo_url && { text: 'Remover foto', style: 'destructive', onPress: handleRemovePhoto },
                ].filter(Boolean)
              );
            }}
            disabled={uploadingPhoto}
            style={styles.avatarTouchable}
          >
            {uploadingPhoto ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : (
              <>
                <Image
                  source={tenant.photo_url || require('../assets/avatar-placeholder.png')}
                  style={styles.avatar}
                  contentFit="cover"
                  transition={200}
                  placeholder={require('../assets/avatar-placeholder.png')}
                  cachePolicy="memory-disk"
                />
                <View style={styles.avatarEditIcon}>
                  <MaterialIcons name="camera-alt" size={24} color={colors.primary} />
                </View>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dados do Inquilino</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nome completo</Text>
            <Text style={styles.infoValue}>{tenant.full_name || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>CPF</Text>
            <Text style={styles.infoValue}>{tenant.cpf || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>RG</Text>
            <Text style={styles.infoValue}>{tenant.rg || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nacionalidade</Text>
            <Text style={styles.infoValue}>{tenant.nationality || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Estado civil</Text>
            <Text style={styles.infoValue}>{tenant.marital_status || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Profissão</Text>
            <Text style={styles.infoValue}>{tenant.profession || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Telefone</Text>
            <View style={styles.phoneRow}>
              <Text style={styles.infoValue}>{tenant.phone || 'N/A'}</Text>
              {tenant.phone && (
                <View style={styles.phoneActions}>
                  <TouchableOpacity
                    style={styles.phoneActionButton}
                    onPress={handleCall}
                  >
                    <MaterialIcons name="phone" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.phoneActionButton}
                    onPress={handleWhatsApp}
                  >
                    <MaterialCommunityIcons name="whatsapp" size={20} color="#25D366" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{tenant.email || 'N/A'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contrato</Text>

          {/* Propriedade vinculada */}

          {tenant.properties ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleOpenProperty}
            >
              <View style={styles.contractPropertyCard}>
                <View style={styles.contractPropertyInfo}>
                  <Text style={styles.contractPropertyAddress} numberOfLines={1} ellipsizeMode="tail">
                    {tenant.properties.address}
                  </Text>
                  <Text style={styles.contractPropertySub}>
                    {formatCurrency(tenant.properties.rent || 0)}/mês
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.contractPropertyAction}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleEndTenancy();
                  }}
                >
                  <MaterialIcons name="close" size={16} color="#F44336" />
                  <Text style={styles.contractPropertyActionText}>Encerrar locação</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.contractPropertyEmpty}>
              <Text style={styles.contractPropertyEmptyText}>
                Nenhum imóvel alugado no momento
              </Text>
            </View>
          )}

          {/* Dados do contrato */}
          {contractLoading ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Contrato</Text>
              <Text style={styles.infoValue}>Carregando...</Text>
            </View>
          ) : contract ? (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Duração do Contrato</Text>
                <Text style={styles.infoValue}>
                  {contract.lease_term != null ? `${contract.lease_term} meses` : 'N/A'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Vencimento</Text>
                <Text style={styles.infoValue}>
                  {contract.due_day ? `Todo dia ${contract.due_day}` : 'N/A'}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Contrato ativo</Text>
              <Text style={styles.infoValue}>Nenhum contrato ativo</Text>
            </View>
          )}

          {/* Resumo financeiro do contrato */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Faturas esperadas (contrato)</Text>
            <Text style={styles.infoValue}>
              {billingLoading ? '...' : billingSummary.expected}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Faturas registradas</Text>
            <Text style={styles.infoValue}>
              {billingLoading ? '...' : billingSummary.paid}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Em atraso</Text>
            <Text
              style={[
                styles.infoValue,
                !billingLoading && billingSummary.overdue > 0 && { color: '#F44336', fontWeight: '600' },
              ]}
            >
              {billingLoading ? '...' : billingSummary.overdue}
            </Text>
          </View>

          {/* Linha do tempo simples das faturas */}
          {billingSchedule.length > 0 && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.timelineTitle}>Meses do contrato</Text>
              <View style={styles.timelineContainer}>
                {billingSchedule.map((item) => (
                  <View
                    key={item.monthIndex}
                    style={[
                      styles.timelinePill,
                      item.status === 'paid' && styles.timelinePillPaid,
                      item.status === 'overdue' && styles.timelinePillOverdue,
                      item.status === 'due_soon' && styles.timelinePillDueSoon,
                    ]}
                  >
                    <Text
                      style={[
                        styles.timelinePillText,
                        (item.status === 'paid' || item.status === 'overdue' || item.status === 'due_soon') &&
                        styles.timelinePillTextEmphasis,
                      ]}
                    >
                      {item.monthIndex}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.timelineLegend}>
                <View style={styles.timelineLegendItem}>
                  <View style={[styles.legendDot, styles.legendDotPaid]} />
                  <Text style={styles.legendText}>Pago</Text>
                </View>
                <View style={styles.timelineLegendItem}>
                  <View style={[styles.legendDot, styles.legendDotOverdue]} />
                  <Text style={styles.legendText}>Em atraso</Text>
                </View>
                <View style={styles.timelineLegendItem}>
                  <View style={[styles.legendDot, styles.legendDotDueSoon]} />
                  <Text style={styles.legendText}>À vencer</Text>
                </View>
                <View style={styles.timelineLegendItem}>
                  <View style={[styles.legendDot, styles.legendDotFuture]} />
                  <Text style={styles.legendText}>Futuro</Text>
                </View>
              </View>
            </View>
          )}

          {/* Ações de contrato */}
          <View style={styles.tenantActions}>
            {tenant.properties && (
              <TouchableOpacity
                style={styles.primaryContractButton}
                onPress={handleRegisterRentPayment}
              >
                <Text style={styles.primaryContractButtonText}>
                  Registrar pagamento de aluguel
                </Text>
              </TouchableOpacity>
            )}
            {/* Botão Cobrar aluguel via WhatsApp - aparece quando é dia de vencimento */}
            {contract &&
              contract.due_day &&
              tenant.phone &&
              (isDueDateToday() || isDueDatePassed() || billingSummary.overdue > 0) && (
                <TouchableOpacity
                  style={[
                    styles.primaryContractButton,
                    {
                      marginTop: tenant.properties ? 8 : 0,
                      backgroundColor: '#25D366',
                    },
                  ]}
                  onPress={handleRentReminder}
                >
                  <MaterialCommunityIcons name="whatsapp" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryContractButtonText}>
                    Cobrar aluguel
                  </Text>
                </TouchableOpacity>
              )}
            <TouchableOpacity
              style={[
                styles.primaryContractButton,
                {
                  marginTop: (tenant.properties || (contract && contract.due_day && tenant.phone && (isDueDateToday() || isDueDatePassed() || billingSummary.overdue > 0))) ? 8 : 0,
                  backgroundColor: theme.colors.surface,
                  borderWidth: theme.isHighContrast ? 2 : 1,
                  borderColor: theme.isHighContrast ? theme.colors.textPrimary : theme.colors.primary,
                },
              ]}
              onPress={() =>
                navigation.navigate('AddContract', {
                  tenantId: tenant.id,
                  contract,
                  // Não passamos mais a propriedade; ela será escolhida na tela de contrato
                })
              }
            >
              <Text style={[
                styles.primaryContractButtonText,
                { color: theme.isHighContrast ? theme.colors.textPrimary : theme.colors.primary }
              ]}>
                {contract ? 'Renovar / editar contrato' : 'Criar contrato'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Seção de Documentos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Documentos</Text>
            <TouchableOpacity
              style={styles.addDocumentButton}
              onPress={handleAddDocument}
              disabled={uploadingDocument}
            >
              {uploadingDocument ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <MaterialIcons name="add" size={20} color={colors.primary} />
                  <Text style={styles.addDocumentButtonText}>Adicionar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {documentsLoading ? (
            <View style={styles.documentsLoading}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.documentsLoadingText}>Carregando documentos...</Text>
            </View>
          ) : documents.length === 0 ? (
            <View style={styles.documentsEmpty}>
              <MaterialIcons name="description" size={48} color={theme.isHighContrast ? theme.colors.textSecondary : "#ccc"} />
              <Text style={styles.documentsEmptyText}>Nenhum documento adicionado</Text>
            </View>
          ) : (
            <View style={styles.documentsList}>
              {documents.map((doc) => (
                <View key={doc.id} style={styles.documentItem}>
                  <View style={styles.documentInfo}>
                    <MaterialIcons
                      name={doc.mime_type === 'application/pdf' ? 'picture-as-pdf' : 'image'}
                      size={24}
                      color={theme.isHighContrast ? theme.colors.textPrimary : theme.colors.primary}
                    />
                    <View style={styles.documentDetails}>
                      <Text style={styles.documentName} numberOfLines={1}>
                        {getDocumentTypeLabel(doc.document_type, doc.custom_name)}
                      </Text>
                      <Text style={styles.documentMeta} numberOfLines={1}>
                        {doc.file_name} • {(doc.file_size / 1024).toFixed(1)} KB
                      </Text>
                    </View>
                  </View>
                  <View style={styles.documentActions}>
                    <TouchableOpacity
                      style={styles.documentActionButton}
                      onPress={() => handleViewDocument(doc)}
                    >
                      <MaterialIcons name="visibility" size={20} color={theme.isHighContrast ? theme.colors.textPrimary : theme.colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.documentActionButton}
                      onPress={() => handleDeleteDocument(doc.id)}
                    >
                      <MaterialIcons name="delete" size={20} color="#F44336" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('EditTenant', { tenant: tenant })}
          >
            <Text style={styles.editButtonText}>Editar Inquilino</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteTenant}>
            <Text style={[styles.buttonText, styles.deleteButtonText]}>Deletar Inquilino</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Sheet de seleção de tipo de documento */}
      <Modal
        visible={showDocumentTypeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseDocumentTypeModal}
      >
        <TouchableOpacity
          style={styles.bottomSheetOverlay}
          activeOpacity={1}
          onPress={handleCloseDocumentTypeModal}
        >
          <Animated.View
            style={[
              styles.bottomSheetContainer,
              {
                transform: [{ translateY: slideAnim }],
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            {/* Handle do bottom sheet */}
            <View style={styles.bottomSheetHandle} />

            {/* Header */}
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Selecione o tipo de documento</Text>
              <TouchableOpacity
                onPress={handleCloseDocumentTypeModal}
                style={styles.bottomSheetCloseButton}
              >
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Lista de documentos */}
            <ScrollView
              style={styles.bottomSheetBody}
              showsVerticalScrollIndicator={false}
            >
              {DOCUMENT_TYPES.map((type) => {
                // Para "outros", verificar se já existem 3 ou mais documentos
                let exists = false;
                let disabled = false;
                let outrosCount = 0;
                if (type.key === 'outros') {
                  outrosCount = countOtherDocuments();
                  exists = outrosCount >= 3;
                  disabled = outrosCount >= 3;
                } else {
                  exists = checkDocumentExists(type.key);
                  disabled = exists;
                }
                return (
                  <TouchableOpacity
                    key={type.key}
                    style={[
                      styles.documentTypeOption,
                      disabled && styles.documentTypeOptionDisabled,
                    ]}
                    onPress={() => !disabled && handleSelectDocumentType(type.key)}
                    disabled={disabled}
                  >
                    <View style={styles.documentTypeOptionLeft}>
                      <Text style={[
                        styles.documentTypeOptionText,
                        disabled && styles.documentTypeOptionTextDisabled,
                      ]}>
                        {type.label}
                      </Text>
                      {type.key === 'outros' && outrosCount > 0 && outrosCount < 3 && (
                        <View style={styles.documentCountBadge}>
                          <Text style={styles.documentCountText}>
                            {outrosCount}/3
                          </Text>
                        </View>
                      )}
                      {exists && (
                        <View style={styles.documentExistsBadge}>
                          <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                          <Text style={styles.documentExistsText}>
                            {type.key === 'outros' ? 'Limite atingido' : 'Enviado'}
                          </Text>
                        </View>
                      )}
                    </View>
                    {!disabled && (
                      <MaterialIcons name="chevron-right" size={20} color="#999" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Modal de nome customizado para documento "outros" */}
      <Modal
        visible={showCustomNameModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowCustomNameModal(false);
          setCustomDocumentName('');
          setSelectedDocumentType(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.customNameModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nome do documento</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCustomNameModal(false);
                  setCustomDocumentName('');
                  setSelectedDocumentType(null);
                }}
                style={styles.modalCloseButton}
              >
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Digite o nome do documento:</Text>
              <TextInput
                style={styles.modalInput}
                value={customDocumentName}
                onChangeText={setCustomDocumentName}
                placeholder="Ex: Certidão de Casamento"
                autoFocus={true}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setShowCustomNameModal(false);
                    setCustomDocumentName('');
                    setSelectedDocumentType(null);
                  }}
                >
                  <Text style={styles.modalButtonCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonConfirm]}
                  onPress={handleConfirmCustomName}
                >
                  <Text style={styles.modalButtonConfirmText}>Continuar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de visualização de documentos */}
      <Modal
        visible={showDocumentViewer}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseDocumentViewer}
      >
        <View style={styles.documentViewerOverlay}>
          <View style={styles.documentViewerContainer}>
            {/* Header */}
            <View style={styles.documentViewerHeader}>
              <Text style={styles.documentViewerTitle} numberOfLines={1}>
                {selectedDocument ? getDocumentTypeLabel(selectedDocument.document_type, selectedDocument.custom_name) : ''}
              </Text>
              <TouchableOpacity
                style={styles.documentViewerCloseButton}
                onPress={handleCloseDocumentViewer}
              >
                <MaterialIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Conteúdo do documento */}
            <View style={styles.documentViewerContent}>
              {documentLoading && (
                <View style={styles.documentViewerLoading}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.documentViewerLoadingText}>Carregando documento...</Text>
                </View>
              )}

              {selectedDocument && (
                <>
                  {selectedDocument.mime_type && selectedDocument.mime_type.startsWith('image/') ? (
                    <ScrollView
                      style={styles.documentImageContainer}
                      contentContainerStyle={styles.documentImageContent}
                      maximumZoomScale={3}
                      minimumZoomScale={1}
                      showsHorizontalScrollIndicator={false}
                      showsVerticalScrollIndicator={false}
                    >
                      <Image
                        source={selectedDocument.file_url}
                        style={styles.documentImage}
                        contentFit="contain"
                        onLoadStart={() => setDocumentLoading(true)}
                        onLoadEnd={() => setDocumentLoading(false)}
                        onError={() => {
                          setDocumentLoading(false);
                          Alert.alert('Erro', 'Não foi possível carregar a imagem.');
                        }}
                        cachePolicy="memory-disk"
                      />
                    </ScrollView>
                  ) : selectedDocument.mime_type === 'application/pdf' ? (
                    <View style={styles.documentPdfContainer}>
                      {documentLoading && (
                        <View style={styles.documentViewerLoading}>
                          <ActivityIndicator size="large" color={colors.primary} />
                          <Text style={styles.documentViewerLoadingText}>Carregando PDF...</Text>
                        </View>
                      )}
                      <WebView
                        source={{ uri: selectedDocument.file_url }}
                        style={styles.documentPdfWebView}
                        onLoadStart={() => setDocumentLoading(true)}
                        onLoadEnd={() => setDocumentLoading(false)}
                        onError={() => {
                          setDocumentLoading(false);
                          Alert.alert('Erro', 'Não foi possível carregar o PDF. Tente abrir no navegador.');
                        }}
                        startInLoadingState={true}
                        scalesPageToFit={true}
                      />
                    </View>
                  ) : (
                    <View style={styles.documentViewerUnsupported}>
                      <MaterialIcons name="description" size={48} color="#ccc" />
                      <Text style={styles.documentViewerUnsupportedText}>
                        Tipo de documento não suportado para visualização
                      </Text>
                      <TouchableOpacity
                        style={styles.documentViewerOpenButton}
                        onPress={() => {
                          if (selectedDocument.file_url) {
                            Linking.openURL(selectedDocument.file_url);
                          }
                        }}
                      >
                        <Text style={styles.documentViewerOpenButtonText}>Abrir no navegador</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
};



export default TenantDetailsScreen;