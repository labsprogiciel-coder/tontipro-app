import { useEffect, useState } from "react";

import { useLocalSearchParams, useRouter } from "expo-router";

import { colors } from "@/constants/colors";
import { useClientStore } from "@/stores/client-store";
import { useTransactionStore } from "@/stores/transaction-store";
import { Transaction } from "@/types/transaction";
import { Client } from "@/types/client";

const ID_TYPE_LABELS: Record<string, string> = {
  cni: "CNI",
  passport: "Passeport",
  permis: "Permis",
  autre: "Autre",
};



  import React from 'react';
  import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
  import { SafeAreaView } from 'react-native-safe-area-context';
  import {
      ChevronLeft,
      MoreHorizontal,
      Pencil,
      MessageSquare,
      Archive,
      ArrowDown,
      ArrowUp,
  } from 'lucide-react-native';
import TransactionItem from "@/app/components/transactions/transaction-items";
import SectionHeader from "@/app/components/ui/section-header";

  
  const ClientDetails = () => {

    const router = useRouter();
    const { id, scannedId } = useLocalSearchParams<{ id: string; scannedId?: string }>();
    const { getClientById, updateClient } = useClientStore();
    const { getTransactionsByClientId } = useTransactionStore();
    const [isLoading, setIsLoading] = useState(true);
    const [client, setClient] = useState<Client | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
  
    useEffect(() => {
      if (id) {
        const clientData = getClientById(id);
        if (clientData) {
          setClient(clientData);
          setTransactions(getTransactionsByClientId(id));
        } else {
          Alert.alert("Erreur", "Client introuvable");
          router.back();
        }
        setIsLoading(false);
      }
    }, [id, getClientById, getTransactionsByClientId, router]);
  
    useEffect(() => {
      if (scannedId && id && client) {
        updateClient(id, {
          idNumber: scannedId,
          kycVerified: true,
          kycDate: new Date().toISOString(),
        }).then((updated) => {
          setClient(updated);
          Alert.alert("KYC mis à jour", `Numéro d'identité enregistré : ${scannedId}`);
        });
      }
    }, [scannedId, id, client, updateClient]);
  
    const handleNewDeposit = () => {
      router.push({
        pathname: "/(app)/transactions/new",
        params: { clientId: id },
      });
    };
  
    const handleNewWithdrawal = () => {
      router.push({
        pathname: "/(app)/transactions/new",
        params: { clientId: id, type: "withdrawal" },
      });
    };
  
    const handleScanKyc = () => {
      router.push({
        pathname: "/(app)/clients/scan",
        params: { clientId: id },
      });
    };
  
    if (isLoading) {
      return (
        <SafeAreaView edges={["bottom"]} style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </SafeAreaView>
      );
    }
      return (
          <SafeAreaView style={styles.container} edges={['top']}>
              <ScrollView showsVerticalScrollIndicator={false}>
  
                  {/* ── Dark Header ── */}
                  <View style={styles.header}>
                      <View style={styles.backRow}>
                          <Pressable style={styles.backBtn} onPress={() => router.back()}>
                              <ChevronLeft color="rgba(255,255,255,0.55)" size={16} strokeWidth={1.8} />
                              <Text style={styles.backLabel}>Mes clients</Text>
                          </Pressable>
                          <Pressable style={styles.moreBtn}>
                              <MoreHorizontal color="white" size={16} />
                          </Pressable>
                      </View>

                      <View style={styles.profileCenter}>
                          <View style={styles.profileAvatar}>
                              <Text style={styles.profileAvatarText}>
                                  {client!.name.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2)}
                              </Text>
                          </View>
                          <Text style={styles.profileName}>{client!.name}</Text>
                          <Text style={styles.profilePhone}>{client!.phone}</Text>
                          <View style={styles.profileBadges}>
                              <View style={styles.badgeActive}>
                                  <Text style={styles.badgeActiveText}>
                                      {client!.status === 'active' ? '● Actif' : '● Inactif'}
                                  </Text>
                              </View>
                              <View style={styles.badgeSince}>
                                  <Text style={styles.badgeSinceText}>
                                      Depuis {new Date(client!.joinDate).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                                  </Text>
                              </View>
                          </View>
                      </View>

                      <View style={styles.statsStrip}>
                          <View style={styles.statCell}>
                              <Text style={styles.statVal}>{client!.balance.toLocaleString('fr-FR')}</Text>
                              <Text style={styles.statLbl}>Solde (FCFA)</Text>
                          </View>
                          <View style={[styles.statCell, styles.statCellBorder]}>
                              <Text style={styles.statVal}>{transactions.length}</Text>
                              <Text style={styles.statLbl}>Transactions</Text>
                          </View>
                          <View style={styles.statCell}>
                              <Text style={styles.statVal}>{client!.savingsGoal ? client!.savingsGoal.toLocaleString('fr-FR') : '—'}</Text>
                              <Text style={styles.statLbl}>Objectif (FCFA)</Text>
                          </View>
                      </View>
                  </View>
  
                  {/* ── Body ── */}
                  <View style={styles.body}>
  
                      {/* Quick Actions */}
                      <View style={styles.actionStrip}>
                          <Pressable style={styles.actBtn} onPress={() => router.push({ pathname: "/(app)/clients/add", params: { clientId: id } })}>
                              <View style={[styles.actIcon, { backgroundColor: '#FAE8E0' }]}>
                                  <Pencil size={15} color="#993C1D" strokeWidth={1.6} />
                              </View>
                              <Text style={styles.actLbl}>Modifier</Text>
                          </Pressable>
                          <Pressable style={styles.actBtn}>
                              <View style={[styles.actIcon, { backgroundColor: '#e6f1fb' }]}>
                                  <MessageSquare size={15} color="#185fa5" strokeWidth={1.5} />
                              </View>
                              <Text style={styles.actLbl}>Note</Text>
                          </Pressable>
                          <Pressable style={styles.actBtn}>
                              <View style={[styles.actIcon, { backgroundColor: '#f5f4f0' }]}>
                                  <Archive size={15} color="#5f5e5a" strokeWidth={1.5} />
                              </View>
                              <Text style={styles.actLbl}>Archiver</Text>
                          </Pressable>
                      </View>
  
                      {/* Informations */}
                      <View style={styles.section}>
                          <SectionHeader title="Informations" linkText="Modifier" onLinkClick={() => router.push({ pathname: "/(app)/clients/add", params: { clientId: id } })} />
                          <View style={styles.infoCard}>
                              <View style={styles.infoRow}>
                                  <Text style={styles.infoLabel}>Nom complet</Text>
                                  <Text style={styles.infoValue}>Awa Konaté</Text>
                              </View>
                              <View style={styles.infoRow}>
                                  <Text style={styles.infoLabel}>Téléphone</Text>
                                  <Text style={[styles.infoValue, styles.infoAccent]}>+226 70 11 22 33</Text>
                              </View>
                              <View style={styles.infoRow}>
                                  <Text style={styles.infoLabel}>Adresse</Text>
                                  <Text style={styles.infoValue}>Gounghin, Ouagadougou</Text>
                              </View>
                              <View style={styles.infoRow}>
                                  <Text style={styles.infoLabel}>Agent référent</Text>
                                  <Text style={styles.infoValue}>Konaté Djibril</Text>
                              </View>
                              <View style={styles.progressWrap}>
                                  <View style={styles.progressTop}>
                                      <Text style={styles.progressLabel}>Progression objectif</Text>
                                      <Text style={styles.progressPct}>68%</Text>
                                  </View>
                                  <View style={styles.progressBarBg}>
                                      <View style={styles.progressBarFill} />
                                  </View>
                                  <Text style={styles.progressSub}>85 000 / 125 000 FCFA · objectif déc. 2025</Text>
                              </View>
                              <View style={[styles.infoRow, styles.infoRowLast]}>
                                  <Text style={styles.infoLabel}>Fréquence</Text>
                                  <Text style={styles.infoValue}>Hebdomadaire</Text>
                              </View>
                          </View>
                      </View>
  
                      {/* Transactions récentes */}
                      <View style={styles.section}>
                          <SectionHeader title="Transactions récentes" linkText="Voir toutes" />
                          <View style={styles.txCard}>
                              <TransactionItem name="Dépôt" type="deposit" time="Aujourd'hui · 10:22" amount="15 000" balance="85 000" />
                              <TransactionItem name="Dépôt" type="deposit" time="14 avr. · 08:55" amount="10 000" balance="70 000" />
                              <TransactionItem name="Retrait" type="withdrawal" time="10 avr. · 14:30" amount="20 000" balance="60 000" />
                              <TransactionItem name="Dépôt" type="deposit" time="07 avr. · 09:10" amount="15 000" balance="80 000" isLast />
                          </View>
                      </View>
  
                      {/* Note de l'agent */}
                      <View style={styles.section}>
                          <SectionHeader title="Note de l'agent" linkText="Modifier" />
                          <View style={styles.noteCard}>
                              <Text style={styles.noteText}>
                                  Cliente très régulière dans ses dépôts. Préfère être contactée le matin avant 11h. À informer dès que son solde dépasse 100 000 FCFA.
                              </Text>
                              <Text style={styles.noteDate}>Dernière mise à jour : 10 avr. 2025 · Konaté D.</Text>
                          </View>
                      </View>
  
                      {/* CTA Buttons */}
                      <View style={styles.bottomActions}>
                          <Pressable style={styles.btnDep} onPress={handleNewDeposit}>
                              <ArrowDown size={14} color="white" strokeWidth={1.8} />
                              <Text style={styles.btnDepText}>Dépôt</Text>
                          </Pressable>
                          <Pressable style={styles.btnRet} onPress={handleNewWithdrawal}>
                              <ArrowUp size={14} color="#1a1a18" strokeWidth={1.8} />
                              <Text style={styles.btnRetText}>Retrait</Text>
                          </Pressable>
                      </View>
  
                  </View>
              </ScrollView>
          </SafeAreaView>
      );
  };
  
  const styles = StyleSheet.create({
    loadingContainer: {},
      container: {
          flex: 1,
          backgroundColor: '#eeede8',
      },
  
      // ── Header ──
      header: {
          backgroundColor: '#1a1a18',
          paddingHorizontal: 18,
          paddingBottom: 24,
          paddingTop: 10,
      },
      backRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 18,
      },
      backBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
      },
      backLabel: {
          fontSize: 13,
          color: 'rgba(255,255,255,0.55)',
      },
      moreBtn: {
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: 'rgba(255,255,255,0.1)',
          justifyContent: 'center',
          alignItems: 'center',
      },
  
      // Profile
      profileCenter: {
          alignItems: 'center',
          gap: 8,
      },
      profileAvatar: {
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: '#FAE8E0',
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 2.5,
          borderColor: 'rgba(255,255,255,0.12)',
      },
      profileAvatarText: {
          fontSize: 22,
          fontWeight: '500',
          color: '#993C1D',
      },
      profileName: {
          fontSize: 18,
          fontWeight: '500',
          color: 'white',
      },
      profilePhone: {
          fontSize: 12,
          color: 'rgba(255,255,255,0.45)',
      },
      profileBadges: {
          flexDirection: 'row',
          gap: 6,
          marginTop: 2,
      },
      badgeActive: {
          backgroundColor: 'rgba(59,109,17,0.3)',
          paddingHorizontal: 9,
          paddingVertical: 3,
          borderRadius: 20,
      },
      badgeActiveText: {
          fontSize: 10,
          color: '#97c459',
      },
      badgeSince: {
          backgroundColor: 'rgba(255,255,255,0.1)',
          paddingHorizontal: 9,
          paddingVertical: 3,
          borderRadius: 20,
      },
      badgeSinceText: {
          fontSize: 10,
          color: 'rgba(255,255,255,0.5)',
      },
  
      // Stats strip
      statsStrip: {
          flexDirection: 'row',
          borderRadius: 14,
          overflow: 'hidden',
          marginTop: 18,
          backgroundColor: 'rgba(255,255,255,0.08)',
      },
      statCell: {
          flex: 1,
          backgroundColor: 'rgba(255,255,255,0.05)',
          paddingVertical: 12,
          paddingHorizontal: 10,
          alignItems: 'center',
      },
      statCellBorder: {
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
      },
      statVal: {
          fontSize: 15,
          fontWeight: '500',
          color: 'white',
      },
      statLbl: {
          fontSize: 10,
          color: 'rgba(255,255,255,0.4)',
          marginTop: 2,
      },
  
      // ── Body ──
      body: {
          paddingBottom: 28,
      },
  
      // Action strip
      actionStrip: {
          flexDirection: 'row',
          gap: 8,
          padding: 16,
          paddingBottom: 0,
      },
      actBtn: {
          flex: 1,
          backgroundColor: 'white',
          borderWidth: 0.5,
          borderColor: 'rgba(0,0,0,0.1)',
          borderRadius: 12,
          paddingVertical: 11,
          paddingHorizontal: 6,
          alignItems: 'center',
          gap: 5,
      },
      actIcon: {
          width: 32,
          height: 32,
          borderRadius: 9,
          justifyContent: 'center',
          alignItems: 'center',
      },
      actLbl: {
          fontSize: 10,
          color: '#5f5e5a',
      },
  
      // Section
      section: {
          paddingHorizontal: 16,
          paddingTop: 16,
      },
  
      // Info card
      infoCard: {
          backgroundColor: 'white',
          borderWidth: 0.5,
          borderColor: 'rgba(0,0,0,0.1)',
          borderRadius: 14,
          overflow: 'hidden',
      },
      infoRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 14,
          paddingVertical: 11,
          borderBottomWidth: 0.5,
          borderBottomColor: 'rgba(0,0,0,0.1)',
      },
      infoRowLast: {
          borderBottomWidth: 0,
      },
      infoLabel: {
          fontSize: 12,
          color: '#5f5e5a',
      },
      infoValue: {
          fontSize: 13,
          fontWeight: '500',
          color: '#1a1a18',
      },
      infoAccent: {
          color: '#D85A30',
      },
  
      // Progress
      progressWrap: {
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderBottomWidth: 0.5,
          borderBottomColor: 'rgba(0,0,0,0.1)',
      },
      progressTop: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 7,
      },
      progressLabel: {
          fontSize: 12,
          color: '#5f5e5a',
      },
      progressPct: {
          fontSize: 12,
          fontWeight: '500',
          color: '#D85A30',
      },
      progressBarBg: {
          height: 6,
          backgroundColor: '#f5f4f0',
          borderRadius: 3,
          overflow: 'hidden',
      },
      progressBarFill: {
          height: '100%',
          width: '68%',
          backgroundColor: '#D85A30',
          borderRadius: 3,
      },
      progressSub: {
          fontSize: 10,
          color: '#888780',
          marginTop: 5,
      },
  
      // Transactions
      txCard: {
          backgroundColor: 'white',
          borderWidth: 0.5,
          borderColor: 'rgba(0,0,0,0.1)',
          borderRadius: 14,
          overflow: 'hidden',
      },
  
      // Note
      noteCard: {
          backgroundColor: 'white',
          borderWidth: 0.5,
          borderColor: 'rgba(0,0,0,0.1)',
          borderRadius: 14,
          padding: 13,
      },
      noteText: {
          fontSize: 12,
          color: '#5f5e5a',
          lineHeight: 20,
      },
      noteDate: {
          fontSize: 10,
          color: '#888780',
          marginTop: 7,
      },
  
      // Bottom actions
      bottomActions: {
          flexDirection: 'row',
          gap: 8,
          paddingHorizontal: 16,
          paddingTop: 16,
      },
      btnDep: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          backgroundColor: '#D85A30',
          borderRadius: 12,
          paddingVertical: 13,
      },
      btnDepText: {
          color: 'white',
          fontSize: 13,
          fontWeight: '500',
      },
      btnRet: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          backgroundColor: 'white',
          borderWidth: 0.5,
          borderColor: 'rgba(0,0,0,0.18)',
          borderRadius: 12,
          paddingVertical: 13,
      },
      btnRetText: {
          color: '#1a1a18',
          fontSize: 13,
          fontWeight: '500',
      },
  });
  
  export default ClientDetails;
  