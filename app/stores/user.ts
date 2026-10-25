import type { UserInfo } from '~/types/transfer'

/**
 * User preferences and identity store.
 * Manages nickname, avatar and sender auto-confirm settings, with local persistence.
 */
export const useUserStore = defineStore('user', () => {
  const userInfo = reactive<UserInfo>({
    nickname: '',
    avatarURL: ''
  })
  const isConfirmDefault = ref(false)
  const hasInitialized = ref(false)

  function persistNickname() {
    if (import.meta.client) {
      localStorage.setItem('nickname', userInfo.nickname)
    }
  }

  function persistAvatar() {
    if (import.meta.client) {
      localStorage.setItem('avatarURL', userInfo.avatarURL)
    }
  }

  function setNickname(nickname: string) {
    const nextNickname = nickname.trim().substring(0, 16)
    userInfo.nickname = nextNickname || genAnimalNickname()
    persistNickname()
  }

  function setAvatarURL(url: string) {
    userInfo.avatarURL = url
    persistAvatar()
  }

  function setConfirmDefault(value: boolean) {
    isConfirmDefault.value = value
    if (import.meta.client) {
      localStorage.setItem('isConfirmDefault', JSON.stringify(value))
    }
  }

  function initAvatar() {
    if (!import.meta.client) {
      return
    }
    const fr = new FileReader()
    fr.onload = () => {
      setAvatarURL(`${fr.result || ''}`)
    }
    fetch('/favicon.webp')
      .then((res) => res.blob())
      .then((blob) => fr.readAsDataURL(blob))
      .catch(console.warn)
  }

  function resetUserInfo() {
    setNickname('')
    initAvatar()
  }

  function openAvatarPicker() {
    selectAvatar((url) => {
      if (url) {
        setAvatarURL(url)
      }
    })
  }

  function initializeFromStorage() {
    if (!import.meta.client || hasInitialized.value) {
      return
    }

    const nickname = localStorage.getItem('nickname')
    if (nickname && !isLegacyNickname(nickname)) {
      userInfo.nickname = nickname
    } else {
      setNickname('')
    }

    const avatarURL = localStorage.getItem('avatarURL')
    if (avatarURL) {
      userInfo.avatarURL = avatarURL
    } else {
      initAvatar()
    }

    isConfirmDefault.value = getValFromLocalStorage('isConfirmDefault', false) || false
    hasInitialized.value = true
  }

  return {
    userInfo,
    isConfirmDefault,
    hasInitialized,
    setNickname,
    setAvatarURL,
    setConfirmDefault,
    initAvatar,
    resetUserInfo,
    openAvatarPicker,
    initializeFromStorage
  }
})
