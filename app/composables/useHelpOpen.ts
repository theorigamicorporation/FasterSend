// Help dialog visibility, shared by the nav bar button and DocPanel
export default function useHelpOpen() {
  return useState('isHelpOpen', () => false)
}
