import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, SafeAreaView, ActivityIndicator } from 'react-native';
import uuid from 'react-native-uuid';
import { theme } from '../theme';
import { addRegistro, getSettings } from '../utils/storage';
import { calcularCaloriasGPT } from '../utils/openai';

export default function AddRegistroScreen({ navigation }) {
  const [tipo, setTipo]               = useState('peso');
  const [nombre, setNombre]           = useState('');
  const [peso, setPeso]               = useState('');
  const [ingredientes, setIngredientes] = useState('');
  const [calorias, setCalorias]       = useState('');
  const [calculando, setCalculando]   = useState(false);
  const [saving, setSaving]           = useState(false);

  async function calcularCalorias() {
    const settings = await getSettings();
    if (!settings.openaiApiKey) {
      Alert.alert(
        '🔑 API Key requerida',
        'Configurá tu API Key de ChatGPT en ⚙️ Configuración para usar esta función.',
        [{ text: 'Cancelar', style: 'cancel' }, { text: 'Ir a Config', onPress: () => navigation.navigate('Settings') }]
      );
      return;
    }
    if (!ingredientes.trim()) { Alert.alert('Sin ingredientes', 'Escribí los ingredientes primero.'); return; }

    setCalculando(true);
    try {
      const kcal = await calcularCaloriasGPT(ingredientes, settings.openaiApiKey);
      setCalorias(String(kcal));
      Alert.alert('✅ Calorías calculadas', `ChatGPT estimó ${kcal} kcal para esta comida.`);
    } catch (e) {
      Alert.alert('Error al calcular', e.message);
    } finally {
      setCalculando(false);
    }
  }

  async function guardar() {
    if (tipo === 'peso' && !peso) { Alert.alert('Falta el peso', 'Ingresá un valor en kg.'); return; }
    if (tipo === 'comida' && !ingredientes && !calorias) { Alert.alert('Faltan datos', 'Ingresá ingredientes o calorías.'); return; }
    setSaving(true);
    try {
      await addRegistro({
        id: uuid.v4(),
        tipo,
        fecha: Date.now(),
        nombre: nombre.trim(),
        peso: tipo === 'peso' ? parseFloat(peso) || null : null,
        ingredientes: tipo === 'comida' ? ingredientes.trim() : '',
        calorias: tipo === 'comida' ? parseInt(calorias) || null : null,
      });
      navigation.goBack();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nuevo registro</Text>
        <View style={{ width:70 }} />
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Selector tipo */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TIPO DE REGISTRO</Text>
          <View style={styles.tipoRow}>
            <TouchableOpacity style={[styles.tipoBtn, tipo==='peso' && styles.tipoBtnPeso]} onPress={() => setTipo('peso')}>
              <Text style={styles.tipoBtnIcon}>⚖️</Text>
              <Text style={[styles.tipoBtnText, tipo==='peso' && { color:'#fff' }]}>Peso</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tipoBtn, tipo==='comida' && styles.tipoBtnComida]} onPress={() => setTipo('comida')}>
              <Text style={styles.tipoBtnIcon}>🍽️</Text>
              <Text style={[styles.tipoBtnText, tipo==='comida' && { color:'#fff' }]}>Comida</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Descripción */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DESCRIPCIÓN (OPCIONAL)</Text>
          <TextInput
            style={styles.input}
            value={nombre} onChangeText={setNombre}
            placeholder={tipo==='peso' ? 'Ej: Mañana en ayunas...' : 'Ej: Almuerzo, Cena...'}
            placeholderTextColor={theme.colors.textDim} maxLength={80}
          />
        </View>

        {/* Campo peso */}
        {tipo === 'peso' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>⚖️ PESO</Text>
            <View style={styles.pesoRow}>
              <TextInput
                style={styles.pesoInput}
                value={peso} onChangeText={setPeso}
                placeholder="75.5"
                placeholderTextColor={theme.colors.textDim}
                keyboardType="decimal-pad" maxLength={6}
              />
              <View style={styles.pesoUnit}><Text style={styles.pesoUnitText}>kg</Text></View>
            </View>
          </View>
        )}

        {/* Campo comida */}
        {tipo === 'comida' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>🍽️ INGREDIENTES</Text>
            <Text style={styles.sectionSub}>Escribí o dictá los ingredientes con cantidades</Text>
            <TextInput
              style={styles.ingredInput}
              value={ingredientes} onChangeText={setIngredientes}
              placeholder="Ej: 200g pollo a la plancha, 100g arroz integral, ensalada..."
              placeholderTextColor={theme.colors.textDim}
              multiline numberOfLines={4} textAlignVertical="top"
            />

            {/* Botón calcular con ChatGPT */}
            <TouchableOpacity
              style={[styles.calcBtn, calculando && { opacity:0.6 }]}
              onPress={calcularCalorias} disabled={calculando}
            >
              {calculando ? (
                <><ActivityIndicator size="small" color="#fff" /><Text style={styles.calcBtnText}>Calculando con ChatGPT...</Text></>
              ) : (
                <><Text style={styles.calcBtnIcon}>🤖</Text><Text style={styles.calcBtnText}>Calcular calorías con ChatGPT</Text></>
              )}
            </TouchableOpacity>

            {/* Campo calorías */}
            <View style={styles.calRow}>
              <Text style={styles.calLabel}>Total de calorías:</Text>
              <TextInput
                style={styles.calInput}
                value={calorias} onChangeText={setCalorias}
                placeholder="0" placeholderTextColor={theme.colors.textDim}
                keyboardType="numeric" maxLength={6}
              />
              <Text style={styles.calUnit}>kcal</Text>
            </View>
          </View>
        )}

        {/* Fecha/hora */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>FECHA Y HORA</Text>
          <Text style={styles.fechaText}>
            📅 {new Date().toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})}
            {'  ·  '}🕐 {new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}
          </Text>
          <Text style={styles.fechaSub}>Se guarda con la fecha y hora actual</Text>
        </View>

        {/* Guardar */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity:0.6 }]}
          onPress={guardar} disabled={saving} activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff"/>
            : <><Text style={styles.saveIcon}>💾</Text><Text style={styles.saveText}>GUARDAR REGISTRO</Text></>
          }
        </TouchableOpacity>
        <View style={{ height:40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:theme.colors.background },
  header:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:theme.colors.border },
  backBtn:{ padding:8 }, backText:{ color:theme.colors.primary, fontSize:15 },
  headerTitle:{ color:theme.colors.text, fontSize:18, fontWeight:'700' },
  scroll:{ flex:1 },
  section:{ margin:16, marginBottom:0, backgroundColor:theme.colors.surface, borderRadius:16, padding:16, borderWidth:1, borderColor:theme.colors.border },
  sectionLabel:{ color:theme.colors.primary, fontSize:11, fontWeight:'700', letterSpacing:1.5, marginBottom:10 },
  sectionSub:{ color:theme.colors.textMuted, fontSize:12, marginBottom:10 },
  tipoRow:{ flexDirection:'row', gap:12 },
  tipoBtn:{ flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, paddingVertical:14, borderRadius:14, backgroundColor:theme.colors.surfaceAlt, borderWidth:1, borderColor:theme.colors.border },
  tipoBtnPeso:{ backgroundColor:theme.colors.accent, borderColor:theme.colors.accent },
  tipoBtnComida:{ backgroundColor:'#ff6584', borderColor:'#ff6584' },
  tipoBtnIcon:{ fontSize:22 }, tipoBtnText:{ color:theme.colors.textMuted, fontSize:16, fontWeight:'700' },
  input:{ backgroundColor:theme.colors.surfaceAlt, borderRadius:12, padding:14, color:theme.colors.text, fontSize:15, borderWidth:1, borderColor:theme.colors.border },
  pesoRow:{ flexDirection:'row', gap:10, alignItems:'center' },
  pesoInput:{ flex:1, backgroundColor:theme.colors.surfaceAlt, borderRadius:12, padding:14, color:theme.colors.text, fontSize:40, fontWeight:'900', textAlign:'center', borderWidth:2, borderColor:theme.colors.accent },
  pesoUnit:{ backgroundColor:theme.colors.accent+'22', borderRadius:12, padding:16, borderWidth:1, borderColor:theme.colors.accent },
  pesoUnitText:{ color:theme.colors.accent, fontSize:18, fontWeight:'700' },
  ingredInput:{ backgroundColor:theme.colors.surfaceAlt, borderRadius:12, padding:14, color:theme.colors.text, fontSize:14, borderWidth:1, borderColor:theme.colors.border, minHeight:100, marginBottom:12 },
  calcBtn:{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:'#10a37f', borderRadius:24, paddingVertical:13, paddingHorizontal:20, marginBottom:14 },
  calcBtnIcon:{ fontSize:18 }, calcBtnText:{ color:'#fff', fontWeight:'700', fontSize:15 },
  calRow:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:theme.colors.surfaceAlt, borderRadius:12, padding:10, borderWidth:1, borderColor:theme.colors.warning },
  calLabel:{ color:theme.colors.text, fontSize:14, fontWeight:'600' },
  calInput:{ backgroundColor:theme.colors.background, borderRadius:8, padding:8, color:theme.colors.warning, fontSize:22, fontWeight:'800', textAlign:'center', minWidth:80, borderWidth:1, borderColor:theme.colors.warning },
  calUnit:{ color:theme.colors.warning, fontWeight:'700', fontSize:13 },
  fechaText:{ color:theme.colors.text, fontSize:13, fontWeight:'600', marginBottom:4 },
  fechaSub:{ color:theme.colors.textMuted, fontSize:11 },
  saveBtn:{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10, margin:16, backgroundColor:theme.colors.success, borderRadius:20, paddingVertical:18, elevation:6 },
  saveIcon:{ fontSize:22 }, saveText:{ color:'#fff', fontSize:18, fontWeight:'900', letterSpacing:1 },
});
