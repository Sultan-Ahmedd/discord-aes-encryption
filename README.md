# 🔐 Discord AES-256 Encrypted Messaging 📩

Welcome to **Discord AES-256 Encrypted Messaging**! This project provides an easy-to-use encrypted messaging feature for Discord, ensuring your private conversations remain secure. Using **AES-256-CBC** encryption, your messages are encrypted and can be safely decrypted by designated users via a dedicated website.

---

## 🌟 **Features**

- **🔒 AES-256-CBC Encryption**: End-to-end encryption for your messages using AES-256-CBC, the gold standard for security.
- **🔓 Decryption Website**: Decrypt your messages easily with our dedicated decryption page.
- **🤐 Publicly Encrypted Messages**: Share encrypted messages in Discord that are visible only to those with the key.
- **💬 Distorted Text in Public Chats**: Messages appear in a distorted form in public chats to conceal sensitive content.

---

## 📥 **How It Works**

### 🛠️ **Encrypting a Message in Discord**
1. Use the `/sendpmessage` command to encrypt and share a message.
2. The encrypted message will be sent to the chat, appearing as distorted or scrambled text to everyone.
3. Only the sender and whitelisted users will receive a DM with the decrypted content.

### 🖥️ **Decrypting a Message**
1. Visit the decryption website here: 👉 [gicaesdecryption.netlify.app](https://gicaesdecryption.netlify.app/)
2. Input the **encrypted message**, **IV**, and **secret key**.
3. Click on **"Decrypt"** to reveal the original message.

**🗝️ Secret Key for Decryption (default)**:
f44KFCOk+T5svYt+qW6F8WPVqcmvmjntw3J7G4wtR34=

### ⚙️ **Commands**

- **/sendpmessage**: Send an encrypted message to public channels. The encrypted content is hidden, and only whitelisted users can decrypt it.
  - **Usage**: `/sendpmessage text:<your message>`

- **/sendencryptedmessage**: Send an encrypted message to a specific encrypted channel.
  - **Usage**: `/sendencryptedmessage message:<your message>`