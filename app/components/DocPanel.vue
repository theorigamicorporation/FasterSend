<script lang="ts" setup>
const { locale } = useI18n()
const isDocPanelShow = ref(false)

const curIP = ref('')

function showDocPanel() {
  isDocPanelShow.value = true
}

onMounted(() => {
  fetch('/api/getIP', { method: 'post' })
    .then((res) => res.text())
    .then((ip) => (curIP.value = ip))
})
</script>

<template>
  <div class="fixed right-5 bottom-20 z-40">
    <Button
      text
      raised
      rounded
      severity="contrast"
      size="large"
      class="shadow-xs shadow-black/25 border-0 dark:border border-white/25"
      @click="showDocPanel"
      aria-label="Document"
    >
      <Icon name="solar:notebook-bookmark-line-duotone" class="text-black/90 dark:text-white/90" />
    </Button>

    <Dialog
      v-model:visible="isDocPanelShow"
      dismissable-mask
      modal
      header="FasterSend"
      class="w-[90vw] md:w-[60vw] max-h-[80vh]"
    >
      <article class="post" v-if="locale === 'de'">
        <p>
          Willkommen bei <b class="underline">FasterSend</b>, einem Web-Tool, das Dateien
          <code>`Peer-to-Peer`</code> und verschlüsselt direkt zwischen Browsern überträgt.
        </p>
        <p>
          Ihre Dateien laufen über keinen fremden Server, das schützt Ihre Privatsphäre. Dafür muss
          der Sender während der Übertragung online bleiben.
        </p>
        <h2>I. Schnellstart</h2>
        <h3>Eine Datei senden</h3>
        <p>
          1. Der Sender klickt auf <b>Datei senden</b> und erhält einen <b>Abholcode</b> (Dateien
          können auch in den Sendebereich gezogen werden).
        </p>
        <p>
          2. Der Empfänger gibt den <b>Abholcode</b> ein, um die Verbindung herzustellen, und wartet
          dann auf die Bestätigung des Senders.
        </p>
        <p>
          3. Der Sender klickt auf <b>Bestätigen</b>, um die Übertragung zu starten (über das
          Profilbild lässt sich die automatische Bestätigung einschalten).
        </p>
        <p>
          4. Der Empfänger klickt auf <b>Empfangen</b>, wählt einen Speicherort, und die Übertragung
          beginnt (ohne direkten Dateisystemzugriff im Browser werden die Daten im Arbeitsspeicher
          gehalten und nach der Übertragung heruntergeladen).
        </p>
        <h3>Einen Ordner senden</h3>
        <p>
          Der Sender klickt auf <b>Ordner senden</b>, die übrigen Schritte sind gleich (Ordner können
          derzeit nicht per Drag-and-drop gesendet werden).
        </p>
        <h2>II. Funktionsweise</h2>
        <p>
          Das Tool nutzt <b>WebRTC</b> für die Peer-to-Peer-Übertragung und die
          <b>modernen Dateizugriffs-APIs</b> zum direkten Lesen und Schreiben im Dateisystem.
        </p>
        <p>
          Bitte stellen Sie daher sicher, dass <b>WebRTC</b> im Browser aktiviert ist. Die
          <b>modernen Dateizugriffs-APIs</b> sind optional; fehlen sie, gilt eine
          <b>Größenbeschränkung</b> und es können <b>keine Ordner empfangen</b> werden.
        </p>
        <p>
          <b>WebRTC</b> prüft alle verfügbaren Netzwerkwege und wählt automatisch den besten. Sind
          Sender und Empfänger im <b>selben lokalen Netzwerk</b>, läuft die Übertragung lokal und
          <b>verbraucht kein externes Datenvolumen</b>.
        </p>
        <h2>III. Hinweise</h2>
        <p>
          1. <b>Peer-to-Peer-Verbindungen</b> müssen in der Regel NAT durchqueren. In komplexen
          Netzwerken, etwa mit aktivem Proxy, kann die <b>Peer-to-Peer-Verbindung</b> scheitern.
          Wechseln Sie dann das Netzwerk oder deaktivieren Sie den Proxy und versuchen Sie es erneut.
        </p>
        <p>
          2. Die verschlüsselte Übertragung schützt Ihre Dateien, kann der Gegenseite aber Ihre
          <b>öffentliche IP-Adresse</b> verraten. Meist ist das eine dynamische
          <b>NAT-Adresse</b>, also unbedenklich. Ihre aktuelle Adresse, wie diese Seite sie sieht,
          steht unten.
          <b>Wenn Ihnen das zu riskant ist, verwenden Sie dieses Tool bitte nicht.</b>
        </p>
        <h2>IV. Datenschutz</h2>
        <h3>1. Datenerhebung</h3>
        <p>
          <b>Wir erheben und speichern keine personenbezogenen Daten oder Dateien.</b> Alle Dateien
          werden per verschlüsselter Peer-to-Peer-Verbindung direkt übertragen und bleiben dabei
          privat.
        </p>
        <h3>2. Dateispeicherung</h3>
        <p>
          Das Tool speichert keine Dateien zwischen. Alle Dateien gehen direkt von Nutzer zu Nutzer,
          die Dateidaten laufen nicht über unsere Systeme.
        </p>
        <h3>3. Datensicherheit</h3>
        <p>
          Die Übertragung ist verschlüsselt, sodass nur Sie und der Empfänger auf die Dateien
          zugreifen können.
        </p>
        <h3>4. Verantwortung der Nutzer</h3>
        <p>
          Bitte halten Sie bei der Nutzung die geltenden Gesetze ein. Sie sind für die Inhalte der
          übertragenen Dateien verantwortlich; wir übernehmen dafür keine Haftung.
        </p>
        <h3>5. Änderungen dieser Erklärung</h3>
        <p>
          Wir können diese Datenschutzerklärung gelegentlich aktualisieren. Änderungen werden auf
          dieser Seite veröffentlicht.
        </p>
      </article>
      <article class="post" v-else-if="locale === 'fr'">
        <p>
          Bienvenue sur <b class="underline">FasterSend</b>, un outil web qui transfère des fichiers
          chiffrés directement entre navigateurs, en <code>`pair à pair`</code>.
        </p>
        <p>
          Vos fichiers ne passent par aucun serveur tiers, ce qui protège votre vie privée. En
          contrepartie, l'expéditeur doit rester en ligne pendant le transfert.
        </p>
        <h2>I. Démarrage rapide</h2>
        <h3>Envoyer un fichier</h3>
        <p>
          1. L'expéditeur clique sur <b>Envoyer un fichier</b> et obtient un
          <b>code de retrait</b> (on peut aussi glisser les fichiers dans la zone d'envoi).
        </p>
        <p>
          2. Le destinataire saisit le <b>code de retrait</b> pour établir la connexion, puis attend
          la confirmation de l'expéditeur.
        </p>
        <p>
          3. L'expéditeur clique sur <b>Confirmer</b> pour lancer le transfert (la confirmation
          automatique s'active depuis la photo de profil).
        </p>
        <p>
          4. Le destinataire clique sur <b>Recevoir</b>, choisit l'emplacement d'enregistrement et le
          transfert démarre (si le navigateur n'a pas d'accès direct au système de fichiers, les
          données restent en mémoire et sont téléchargées à la fin du transfert).
        </p>
        <h3>Envoyer un dossier</h3>
        <p>
          L'expéditeur clique sur <b>Envoyer un dossier</b>, les autres étapes sont identiques (le
          glisser-déposer de dossiers n'est pas encore pris en charge).
        </p>
        <h2>II. Fonctionnement</h2>
        <p>
          L'outil utilise <b>WebRTC</b> pour le transfert en pair à pair et les
          <b>API modernes d'accès aux fichiers</b> pour lire et écrire directement sur le disque.
        </p>
        <p>
          Assurez-vous donc que <b>WebRTC</b> est activé dans votre navigateur. Les
          <b>API modernes d'accès aux fichiers</b> sont facultatives ; sans elles, la
          <b>taille des fichiers est limitée</b> et il est <b>impossible de recevoir des dossiers</b>.
        </p>
        <p>
          <b>WebRTC</b> teste tous les chemins réseau disponibles et choisit automatiquement le
          meilleur. Si l'expéditeur et le destinataire sont sur le <b>même réseau local</b>, le
          transfert reste local et <b>ne consomme pas de bande passante externe</b>.
        </p>
        <h2>III. Précautions</h2>
        <p>
          1. Les <b>connexions pair à pair</b> doivent généralement traverser le NAT. Dans un réseau
          complexe, par exemple avec un proxy actif, la <b>connexion pair à pair</b> peut échouer.
          Changez de réseau ou désactivez le proxy, puis réessayez.
        </p>
        <p>
          2. Le transfert chiffré protège vos fichiers, mais peut révéler votre
          <b>adresse IP publique</b> au correspondant. Il s'agit le plus souvent d'une
          <b>adresse NAT</b> dynamique, sans danger particulier. Votre adresse actuelle, telle que ce
          site la voit, est affichée ci-dessous.
          <b>Si cela vous semble risqué, n'utilisez pas cet outil.</b>
        </p>
        <h2>IV. Confidentialité</h2>
        <h3>1. Collecte d'informations</h3>
        <p>
          <b>Nous ne collectons ni ne conservons aucune donnée personnelle ni aucun fichier.</b> Tous
          les fichiers sont transmis directement par une connexion pair à pair chiffrée et restent
          privés.
        </p>
        <h3>2. Stockage des fichiers</h3>
        <p>
          L'outil ne stocke aucun fichier, même temporairement. Les fichiers passent directement
          d'un utilisateur à l'autre, sans transiter par nos systèmes.
        </p>
        <h3>3. Sécurité des données</h3>
        <p>
          Le transfert est chiffré, de sorte que seuls vous et le destinataire pouvez accéder aux
          fichiers.
        </p>
        <h3>4. Responsabilité des utilisateurs</h3>
        <p>
          Respectez la législation en vigueur lorsque vous utilisez l'outil. Vous êtes responsable
          du contenu des fichiers transférés ; nous déclinons toute responsabilité à ce sujet.
        </p>
        <h3>5. Modifications de cette déclaration</h3>
        <p>
          Cette déclaration de confidentialité peut être mise à jour. Les modifications seront
          publiées sur cette page.
        </p>
      </article>
      <article class="post" v-else>
        <p>
          Welcome to <b class="underline">FasterSend</b>, a web tool for securely transferring files
          using browser <code>`peer-to-peer`</code> encryption.
        </p>
        <p>
          Your file data will not pass through third-party servers, ensuring privacy and security.
          Accordingly, the sender needs to remain online during the transfer.
        </p>
        <h2>I. Quick Start</h2>
        <h3>Send a Single File</h3>
        <p>
          1. The sender clicks <b>Send File</b> to obtain the <b>Pickup Code</b> (files can also be
          dragged and dropped into the sending area).
        </p>
        <p>
          2. The receiver enters the <b>Pickup Code</b> to start peer-to-peer pairing, and waits for
          the sender to confirm after successful pairing.
        </p>
        <p>
          3. The sender clicks <b>Confirm</b> to continue the transfer (the sender can open their
          profile picture to set automatic confirmation).
        </p>
        <p>
          4. The receiver clicks <b>Receive</b>, selects the save path, and then starts the transfer
          (if the browser does not support direct access to the file system, data will temporarily
          reside in memory, triggering a download after the transfer is complete).
        </p>
        <h3>Send a Directory</h3>
        <p>
          The sender clicks <b>Send Directory</b>, and the other steps are the same (directories do
          not currently support direct drag and drop).
        </p>
        <h2>II. How It Works</h2>
        <p>
          This tool uses <b>WebRTC</b> to provide peer-to-peer data transfer and utilizes
          <b>Modern File Access API</b> for direct file system read and write.
        </p>
        <p>
          Therefore, please ensure that the browser has <b>WebRTC</b> enabled. The
          <b>Modern File Access API</b> is optional; if unavailable, it will result in
          <b>file size limitations</b> and <b>inability to receive directories</b>.
        </p>
        <p>
          <b>WebRTC</b> will traverse all available networks and automatically select the optimal
          route. If both the sender and receiver are on the <b>same local area network</b>, it will
          automatically use local network transfer,
          <b>which will not consume external bandwidth</b>.
        </p>
        <h2>III. Precautions</h2>
        <p>
          1. Since <b>peer-to-peer connections</b> generally require NAT traversal, in complex
          network environments such as when using a proxy, it may lead to
          <b>peer-to-peer connection</b> failures. Please switch networks or disable the proxy and
          try again.
        </p>
        <p>
          2. Peer-to-peer encrypted transfer ensures the security of file data, but it may leak your
          <b>outbound IP address</b> to the other party. In most cases, this is a dynamic
          <b>NAT outbound address</b>, so there is no need to worry. You can see your current
          outbound IP address relative to this site below.
          <b>If you feel this poses a risk, please suspend the use of this tool.</b>
        </p>
        <h2>IV. Privacy Statement</h2>
        <h3>1. Information Collection</h3>
        <p>
          <b>We do not collect or store any personal information or files from you.</b> When you use
          our tools, all files are transmitted directly through peer-to-peer encryption technology,
          ensuring that your data remains private and secure during transmission.
        </p>
        <h3>2. File Storage</h3>
        <p>
          Our tools do not temporarily store users' files. All transmitted files are passed directly
          between users, and file data does not go through our system.
        </p>
        <h3>3. Data Security</h3>
        <p>
          We use advanced encryption technology to protect the security of your files during
          transmission. Your files will be encrypted during transmission, ensuring that only you and
          the recipient can access them.
        </p>
        <h3>4. User Responsibility</h3>
        <p>
          Please ensure that you comply with relevant laws and regulations when using our tools and
          are responsible for the content of the files you transmit. We do not assume any
          responsibility for the content of files transmitted by users.
        </p>
        <h3>5. Changes to the Privacy Policy</h3>
        <p>
          We may update this privacy statement from time to time. Any changes will be posted on this
          page, and we recommend that you check regularly for the latest information.
        </p>
      </article>
      <Divider />
      <p class="text-center text-xs tracking-wider mb-4">
        Based on
        <a
          target="_blank"
          href="https://github.com/ShouChenICU/FastSend"
          class="underline hover:text-sky-500"
          >FastSend</a
        >
        by ShouChenICU (MIT)
      </p>
      <div class="text-center tracking-wider">
        <p class="text-xs">{{ $t('label.yourIP') }}</p>
        <p class="my-1">{{ curIP }}</p>
        <p class="text-xs">{{ $t('label.relativeToSite') }}</p>
      </div>
    </Dialog>
  </div>
</template>

<style>
@reference '~/assets/main.css';

.post {
  @apply tracking-wide;
}

.post p {
  @apply text-sm my-1;
}

.post h2 {
  @apply text-xl my-4 font-bold;
}

.post h3 {
  @apply text-lg my-2 font-semibold;
}
</style>
