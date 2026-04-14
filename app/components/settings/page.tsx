import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    User,
    ShieldCheck,
    Bell,
    CloudSunIcon,
    Languages,
    Info,
    LogOut,
    ChevronRight,
    Database,
    LucideIcon,
    Upload,
    DatabaseBackup,
    AlertTriangle,
    Download,
    Users2
} from 'lucide-react-native';

interface SettingItemProps {
    icon: LucideIcon;
    label: string;
    value?: string;
    onPress: () => void;
    destructive?: boolean;
}

const SettingItem = ({ icon: Icon, label, value, onPress, destructive = false }: SettingItemProps) => (
    <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.item, pressed && styles.pressed]}
    >
        <View style={[styles.itemLeft, destructive && styles.destructiveBg]}>
            <Icon size={20} color={destructive ? "#a32d2d" : "#5f5e5a"} />
            <Text style={[styles.itemLabel, destructive && styles.destructiveText]}>{label}</Text>
        </View>
        <View style={styles.itemRight}>
            {value && <Text style={styles.itemValue}>{value}</Text>}
            <ChevronRight size={18} color="#888780" />
        </View>
    </Pressable>
);
const SettingsScreen = () => {
    const [isBiometricActive, setIsBiometricActive] = useState(true);
    const [isOfflineMode, setIsOfflineMode] = useState(false);

    const handleExport = () => {
        Alert.alert(
            "Exporter les données",
            "Voulez-vous créer une sauvegarde locale de toutes vos transactions et clients ?",
            [
                { text: "Annuler", style: "cancel" },
                { text: "Exporter", onPress: () => console.log("Exporting JSON...") }
            ]
        );
    };

    const handleImport = () => {
        Alert.alert(
            "Attention : Importation",
            "L'importation de données écrasera votre base de données actuelle. Cette action est irréversible.",
            [
                { text: "Annuler", style: "cancel" },
                { text: "Continuer", style: "destructive", onPress: () => console.log("Opening file picker...") }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Page Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Paramètres</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Profile Card Summary */}
                <View style={styles.section}>
                    <View style={styles.profileCard}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>SW</Text>
                        </View>
                        <View style={styles.profileInfo}>
                            <Text style={styles.profileName}>Serge Wilfried</Text>
                            <Text style={styles.profileId}>Agent ID: #782901</Text>
                        </View>
                        <Pressable style={styles.editBtn}>
                            <Text style={styles.editBtnText}>Modifier</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Security Section */}
                <Text style={styles.sectionLabel}>Sécurité & Accès</Text>
                <View style={styles.section}>
                    <SettingItem icon={ShieldCheck} label="Modifier le PIN" onPress={() => { }} />
                    <View style={styles.divider} />
                    <View style={styles.item}>
                        <View style={styles.itemLeft}>
                            <User size={20} color="#5f5e5a" />
                            <Text style={styles.itemLabel}>FaceID / Empreinte</Text>
                        </View>
                        <Switch
                            value={isBiometricActive}
                            onValueChange={setIsBiometricActive}
                            trackColor={{ false: "#d0cfc8", true: "#D85A30" }}
                        />
                    </View>
                    <View style={styles.divider} />
                    <SettingItem icon={Users2} label="Membres" onPress={() => { }} />

                </View>
                {/* Sync & Offline - CRITICAL for your market */}
                <Text style={styles.sectionLabel}>Données & Synchronisation</Text>
                <View style={styles.section}>
                    <View style={styles.item}>
                        <View style={styles.itemLeft}>
                            <Database size={20} color="#5f5e5a" />
                            <Text style={styles.itemLabel}>Mode Hors-ligne Forcé</Text>
                        </View>
                        <Switch
                            value={isOfflineMode}
                            onValueChange={setIsOfflineMode}
                            trackColor={{ false: "#d0cfc8", true: "#D85A30" }}
                        />
                    </View>
                    <View style={styles.divider} />
                    <SettingItem icon={CloudSunIcon} label="Forcer la Synchronisation" value="Sync à 14:10" onPress={() => { }} />
                    <View style={styles.divider} />
                    <SettingItem icon={Info} label="Espace de stockage" value="12.4 MB" onPress={() => { }} />
                </View>
                <View style={styles.container}>
                    <Text style={styles.sectionLabel}>Sauvegarde & Restauration</Text>
                    <View style={styles.section}>

                        {/* Export Feature */}
                        <SettingItem
                            icon={Download}
                            label="Exporter les données"
                            value="Format .JSON"
                            onPress={handleExport}
                        />

                        <View style={styles.divider} />

                        {/* Import Feature */}
                        <SettingItem
                            icon={Upload}
                            label="Importer une sauvegarde"
                            onPress={handleImport}
                        />

                        <View style={styles.divider} />

                        {/* Backup Status Info */}
                        <View style={styles.infoBox}>
                            <DatabaseBackup size={16} color="#888780" />
                            <Text style={styles.infoText}>
                                Dernière sauvegarde locale : Aujourd'hui à 10:45
                            </Text>
                        </View>
                    </View>

                    {/* Warning for agents */}
                    <View style={styles.warningContainer}>
                        <AlertTriangle size={14} color="#993C1D" />
                        <Text style={styles.warningText}>
                            Utilisez l'importation uniquement sous la supervision d'un administrateur.
                        </Text>
                    </View>
                </View>
                {/* General Preferences */}
                <Text style={styles.sectionLabel}>Préférences</Text>
                <View style={styles.section}>
                    <SettingItem icon={Languages} label="Langue" value="Français" onPress={() => { }} />
                    <View style={styles.divider} />
                    <SettingItem icon={Bell} label="Notifications" onPress={() => { }} />
                </View>

                {/* Sign Out */}
                <View style={[styles.section, { marginTop: 10, marginBottom: 40 }]}>
                    <SettingItem
                        icon={LogOut}
                        label="Déconnexion"
                        onPress={() => { }}
                        destructive={true}
                    />
                </View>

                <Text style={styles.versionText}>Kauridorr v1.0.4 • Made with ❤️ for Burkina Faso</Text>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#eeede8' },
    header: { paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#ffffff', borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.1)' },
    headerTitle: { fontSize: 22, fontWeight: '700', color: '#1a1a18' },
    scrollContent: { padding: 16 },
    sectionLabel: { fontSize: 11, fontWeight: '600', color: '#888780', textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
    section: { backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.1)', overflow: 'hidden', marginBottom: 20 },
    profileCard: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#D85A30', justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: 'white', fontWeight: '700', fontSize: 18 },
    profileInfo: { flex: 1, marginLeft: 12 },
    profileName: { fontSize: 16, fontWeight: '600', color: '#1a1a18' },
    profileId: { fontSize: 12, color: '#5f5e5a', marginTop: 2 },
    editBtn: { backgroundColor: '#f5f4f0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    editBtnText: { fontSize: 12, fontWeight: '600', color: '#5f5e5a' },
    item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, height: 56 },
    itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    itemLabel: { fontSize: 14, color: '#1a1a18', fontWeight: '500' },
    itemRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    itemValue: { fontSize: 13, color: '#888780' },
    divider: { height: 0.5, backgroundColor: 'rgba(0,0,0,0.05)', marginLeft: 48 },
    pressed: { backgroundColor: '#f5f4f0' },
    destructiveText: { color: '#a32d2d' },
    versionText: { textAlign: 'center', color: '#888780', fontSize: 11, marginBottom: 20 },
    destructiveBg: { backgroundColor: 'rgba(163, 45, 45, 0.1)' },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#f9f9f7',
        gap: 10,
    },
    infoText: {
        fontSize: 12,
        color: '#888780',
        fontStyle: 'italic',
    },
    warningContainer: {
        flexDirection: 'row',
        paddingHorizontal: 8,
        marginTop: -10,
        marginBottom: 20,
        gap: 6,
        alignItems: 'center',
    },
    warningText: {
        fontSize: 11,
        color: '#993C1D',
        fontWeight: '500',
    },
});

export default SettingsScreen;