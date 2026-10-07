import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Modal içindeki form diyalogları için tam ekran arka plan.
 *
 * - Klavye açılınca alttan klavye yüksekliği kadar boşluk bırakır (KeyboardAvoidingView,
 *   'padding'), böylece içerideki diyalog küçülür ve klavyenin üstünde kalır. Android'de
 *   (edge-to-edge) pencere adjustResize ile küçülmediği için bu hesap iki platformda da
 *   gerekir; pencere yine de küçülürse KAV'ın çakışma hesabı 0 çıkar, çift boşluk oluşmaz.
 * - Güvenli alan (çentik, durum/gezinme çubuğu) kadar iç boşluk ekler.
 * - Diyalog dışına dokunmak klavyeyi kapatır.
 *
 * Doğru hesap için Modal'ın tüm ekranı kaplaması gerekir:
 * `<Modal transparent statusBarTranslucent navigationBarTranslucent>`.
 */
export function KeyboardAvoidingBackdrop({
  children,
  style,
  backdropColor,
}: {
  children: ReactNode;
  /** İçerik yerleşimi (hizalama, kenar boşluğu). */
  style?: StyleProp<ViewStyle>;
  backdropColor?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'web' ? undefined : 'padding'}
      style={[styles.fill, backdropColor ? { backgroundColor: backdropColor } : null]}
    >
      <View
        style={[
          styles.fill,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
      >
        <View style={[styles.fill, style]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={Keyboard.dismiss} accessible={false} />
          {children}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const REVEAL_MARGIN = 16;

/**
 * Form içeriği için ScrollView:
 * - klavye açıkken boş alana dokunmak klavyeyi kapatır, butonlara dokunmak çalışır,
 * - kaydırmaya başlamak klavyeyi kapatır,
 * - klavye açıldığında / görünür alan küçüldüğünde odaktaki alanı görünür hale kaydırır.
 */
export function FormScrollView({ onScroll, onLayout, scrollEventThrottle, ...rest }: ScrollViewProps) {
  const ref = useRef<ScrollView>(null);
  const offsetY = useRef(0);
  const viewportH = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reveal = useCallback(() => {
    if (Platform.OS === 'web') return;
    const scroll = ref.current;
    const host = scroll?.getNativeScrollRef();
    const input = TextInput.State.currentlyFocusedInput();
    if (!scroll || !host || !input) return;
    host.measureInWindow((_sx, sy, _sw, sh) => {
      input.measureInWindow((_x, y, _w, h) => {
        if (sh <= 0 || h <= 0) return;
        const top = y - REVEAL_MARGIN;
        const bottom = y + h + REVEAL_MARGIN;
        let delta = 0;
        if (bottom > sy + sh) {
          // Alt kenarı göster, ama uzun bir alanın üst kenarını yukarı taşırma
          delta = Math.min(bottom - (sy + sh), top - sy);
        } else if (top < sy) {
          delta = top - sy;
        }
        if (Math.abs(delta) > 1) {
          scroll.scrollTo({ y: Math.max(0, offsetY.current + delta), animated: true });
        }
      });
    });
  }, []);

  const scheduleReveal = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    // Yerleşim (KAV boşluğu / diyalog küçülmesi) otursun diye kısa bir gecikme
    timer.current = setTimeout(reveal, 80);
  }, [reveal]);

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', scheduleReveal);
    return () => {
      sub.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [scheduleReveal]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (viewportH.current > 0 && h < viewportH.current) scheduleReveal();
    viewportH.current = h;
    onLayout?.(e);
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetY.current = e.nativeEvent.contentOffset.y;
    onScroll?.(e);
  };

  return (
    <ScrollView
      ref={ref}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      {...rest}
      onLayout={handleLayout}
      onScroll={handleScroll}
      scrollEventThrottle={scrollEventThrottle ?? 16}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
