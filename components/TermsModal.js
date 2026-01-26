// components/TermsModal.js
import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Modal,
    SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, radii } from '../theme';

/**
 * Modal que exibe os Termos de Uso do aplicativo.
 * Usado na tela de assinaturas para não abrir links externos.
 */
const TermsModal = ({ visible, onClose }) => {
    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Termos e Privacidade</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <MaterialIcons name="close" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={styles.scrollContainer}
                    contentContainerStyle={styles.scrollContent}
                >
                    <Text style={styles.lastUpdated}>
                        Última atualização: 26 de Janeiro de 2026
                    </Text>

                    <View style={styles.section}>
                        <Text style={styles.text}>
                            Bem-vindo ao Llord. Este documento unificado contém os Termos de Uso (regras de utilização) e a Política de Privacidade (como tratamos seus dados), regendo a relação entre você ("Usuário") e a plataforma Llord ("Nós", "Plataforma" ou "Aplicativo").
                        </Text>
                        <Text style={styles.text}>
                            Ao criar uma conta ou utilizar nossos serviços, você confirma que leu, compreendeu e concorda com todos os termos abaixo.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { fontSize: 18, marginBottom: 16 }]}>PARTE I: TERMOS DE USO E CONDIÇÕES GERAIS</Text>

                        <Text style={styles.sectionTitle}>1. O SERVIÇO OFERECIDO</Text>
                        <Text style={styles.text}>
                            O Llord é uma plataforma SaaS (Software as a Service) de gestão imobiliária projetada para facilitar a administração de propriedades. As funcionalidades incluem, mas não se limitam a:
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Gestão de Propriedades: Cadastro, edição e organização de imóveis residenciais ou comerciais.
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Gestão de Inquilinos: Cadastro de dados pessoais, profissionais e financeiros de locatários.
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Gestão Documental: Armazenamento digital de documentos (contratos, comprovantes de renda, documentos pessoais) via nuvem segura.
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Controle Financeiro: Registro de transações, aluguéis e geração de relatórios financeiros simples.
                        </Text>
                        <Text style={styles.text}>
                            Isenção de Responsabilidade: O Llord é uma ferramenta tecnológica de organização. Não prestamos serviços de consultoria jurídica, imobiliária, contábil ou bancária. O uso de modelos de contrato ou cálculos financeiros é de inteira responsabilidade do Usuário.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>2. CADASTRO E ELEGIBILIDADE</Text>
                        <Text style={styles.text}>
                            2.1. Tipos de Conta: O serviço está disponível para Pessoas Físicas, Empresas e Assessorias.
                        </Text>
                        <Text style={styles.text}>
                            2.2. Veracidade: Você se compromete a fornecer dados verdadeiros (Nome, CPF/CNPJ, Telefone, Email) e a mantê-los atualizados.
                        </Text>
                        <Text style={styles.text}>
                            2.3. Segurança: A senha de acesso é pessoal e intransferível. Qualquer atividade realizada com sua senha será de sua responsabilidade.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>3. ASSINATURAS E PAGAMENTOS</Text>
                        <Text style={styles.text}>
                            3.1. Planos: O Llord opera sob modelo "Freemium", oferecendo um plano Gratuito (com limitações) e planos Pagos (Basic/Premium) que desbloqueiam funcionalidades como maior número de inquilinos e propriedades.
                        </Text>
                        <Text style={styles.text}>
                            3.2. Processamento: As assinaturas são gerenciadas e processadas diretamente pelas lojas de aplicativos (Apple App Store e Google Play Store). O Llord não armazena dados de cartão de crédito.
                        </Text>
                        <Text style={styles.text}>
                            3.3. Renovação e Cancelamento: A renovação é automática conforme as regras da loja de aplicativos. O cancelamento deve ser feito pelo usuário nas configurações do seu dispositivo (Apple ID ou Google Play) antes da data de renovação.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>4. USO DE DADOS DE TERCEIROS (INQUILINOS)</Text>
                        <Text style={styles.text}>
                            Esta é uma cláusula essencial para sua proteção jurídica:
                        </Text>
                        <Text style={styles.text}>
                            4.1. Ao inserir dados pessoais ou documentos de terceiros (inquilinos/fiadores) na plataforma, você declara e garante que:
                        </Text>
                        <Text style={styles.bulletPoint}>
                            * Obteve o consentimento expresso do titular dos dados para o armazenamento dessas informações; ou
                        </Text>
                        <Text style={styles.bulletPoint}>
                            * Possui outra base legal válida (como execução de contrato de locação) para tratar esses dados.
                        </Text>
                        <Text style={styles.text}>
                            4.2. Indenização: Você concorda em isentar e indenizar o Llord de quaisquer reclamações, processos ou multas decorrentes da coleta ou uso indevido de dados de terceiros que você inseriu na plataforma.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>5. PROIBIÇÕES E USO ACEITÁVEL</Text>
                        <Text style={styles.text}>
                            É estritamente proibido utilizar o aplicativo para:
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Armazenar conteúdo ilegal, pornográfico ou que viole direitos autorais.
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Engenharia reversa ou tentativa de burlar os sistemas de segurança do App.
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Fins discriminatórios na gestão de inquilinos.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { fontSize: 18, marginBottom: 16, marginTop: 16 }]}>PARTE II: POLÍTICA DE PRIVACIDADE E PROTEÇÃO DE DADOS (LGPD)</Text>
                        <Text style={styles.text}>
                            Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), explicamos como seus dados são tratados.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>1. DEFINIÇÃO DE PAPÉIS (CONTROLADOR VS. OPERADOR)</Text>
                        <Text style={styles.text}>
                            Para garantir a transparência no tratamento de dados:
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Llord como CONTROLADOR: Somos responsáveis pelos dados do Usuário (Você, proprietário/gestor), coletados para criar sua conta e faturar serviços.
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Llord como OPERADOR: Somos apenas processadores dos dados dos Inquilinos que você insere. O Controlador desses dados é VOCÊ. Nós fornecemos a infraestrutura segura para que você exerça a gestão.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>2. DADOS COLETADOS</Text>

                        <Text style={styles.textTitle}>2.1. Dados do Usuário (Você)</Text>
                        <Text style={styles.bulletPoint}>
                            • Identificação: Nome completo, CPF, RG, Nacionalidade, Estado Civil, Profissão.
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Contato: Email e Telefone/Celular.
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Dispositivo: Informações técnicas para suporte e notificações push.
                        </Text>

                        <Text style={[styles.textTitle, { marginTop: 8 }]}>2.2. Dados Gerenciados (Seus Inquilinos e Imóveis)</Text>
                        <Text style={styles.bulletPoint}>
                            • Dados Pessoais: Nome, CPF, RG, Profissão, Estado Civil, Nacionalidade e contatos.
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Documentos: Imagens ou PDFs de CPF, RG, Comprovantes de Renda, Comprovantes de Residência e Contratos.
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Imagens: Fotos das propriedades gerenciadas.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>3. FINALIDADE DO TRATAMENTO</Text>
                        <Text style={styles.text}>
                            Utilizamos os dados para:
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Execução do Contrato: Permitir o acesso às funcionalidades do app (gestão de imóveis, inquilinos e contratos).
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Segurança: Autenticação de usuários e prevenção a fraudes.
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Comunicação: Envio de confirmações de conta, recuperação de senha e notificações importantes sobre o serviço.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>4. ARMAZENAMENTO E SEGURANÇA</Text>
                        <Text style={styles.text}>
                            4.1. Infraestrutura: Seus dados e documentos são armazenados em servidores de nuvem de alta segurança fornecidos pelo Supabase, utilizando criptografia em trânsito (SSL/TLS) e em repouso.
                        </Text>
                        <Text style={styles.text}>
                            4.2. Controle de Acesso: Os documentos dos inquilinos são protegidos por políticas de segurança rigorosas (RLS - Row Level Security), garantindo que apenas o usuário que fez o upload tenha acesso a eles.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>5. PERMISSÕES DO DISPOSITIVO</Text>
                        <Text style={styles.text}>
                            Para funcionamento pleno, o aplicativo solicita acesso a:
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Câmera e Galeria: Para tirar fotos de imóveis e digitalizar documentos dos inquilinos.
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Notificações: Para alertas sobre vencimentos ou atualizações do sistema.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>6. SEUS DIREITOS (LGPD)</Text>
                        <Text style={styles.text}>
                            Você tem o direito de solicitar:
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Confirmação e acesso aos seus dados.
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Correção de dados incompletos ou desatualizados (disponível na tela "Editar Perfil").
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Exclusão da conta e dos dados associados.
                        </Text>
                        <Text style={styles.text}>
                            Nota sobre Exclusão: Ao excluir sua conta de Usuário, todos os dados de inquilinos, contratos e documentos vinculados à sua conta serão permanentemente excluídos de nossos servidores, sem possibilidade de recuperação.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>7. CONTATO</Text>
                        <Text style={styles.text}>
                            Para questões relacionadas a estes Termos ou à Privacidade de dados, entre em contato através do suporte no aplicativo ou pelo e-mail oficial: design@kavicki.com
                        </Text>
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            Ao continuar, você confirma que leu, entendeu e concorda com estes Termos de Uso.
                        </Text>
                    </View>
                </ScrollView>

                <TouchableOpacity style={styles.confirmButton} onPress={onClose}>
                    <Text style={styles.confirmButtonText}>Entendi</Text>
                </TouchableOpacity>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
        backgroundColor: colors.surface,
    },
    headerTitle: {
        ...typography.sectionTitle,
        fontSize: 18,
    },
    closeButton: {
        padding: 4,
    },
    scrollContainer: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 32,
    },
    lastUpdated: {
        ...typography.caption,
        marginBottom: 20,
        textAlign: 'center',
        color: colors.textMuted,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        ...typography.sectionTitle,
        marginBottom: 12,
        fontSize: 16,
    },
    text: {
        ...typography.body,
        marginBottom: 12,
        lineHeight: 22,
    },
    textTitle: {
        ...typography.bodyStrong,
        marginBottom: 8,
        marginTop: 8,
    },
    bulletPoint: {
        ...typography.body,
        marginLeft: 16,
        marginBottom: 8,
        lineHeight: 22,
    },
    footer: {
        marginTop: 20,
        padding: 16,
        backgroundColor: colors.primarySoft,
        borderRadius: radii.md,
        marginBottom: 20,
    },
    footerText: {
        ...typography.bodyStrong,
        textAlign: 'center',
        color: colors.primary,
    },
    confirmButton: {
        backgroundColor: colors.primary,
        margin: 16,
        paddingVertical: 14,
        borderRadius: radii.pill,
        alignItems: 'center',
    },
    confirmButtonText: {
        ...typography.button,
        color: '#fff',
    },
});

export default TermsModal;
