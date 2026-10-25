# Scenarios

## Sender

- Choose a file or directory
- Setup
  - Connect to the signalling server
    - Connection fails (error)
  - Get a receive code
    - Too many connections, try again later (error -1)
- Waiting for the recipient
  - Signalling connection drops or times out (error)
  - Recipient cannot receive directories, no File System Access API (error)
  - User confirms whether to send
- Transfer
  - Peer disconnects (error)
- Transfer complete

## Recipient

- Setup
  - Connect to the signalling server
    - Fails (error)
    - Peer not found (error 404)
  - Connect to the peer
    - Times out (error)
  - Receive basic info (user, type, files)
    - Directory transfer not supported (error)
  - Show the info and wait for the user to continue
    - Directory sync
      - Wait for the user to choose a directory
      - Compare differences
      - Wait for the user to choose files (added, updated, deleted)
      - Wait to continue
- Transfer
  - Peer disconnects (error)
- Transfer complete
  - Show a summary of the transfer
  - Show buttons such as back to home
