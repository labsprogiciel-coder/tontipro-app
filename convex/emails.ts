// convex/emails.ts
import { action } from './_generated/server'
import { v } from 'convex/values'

/**
 * Envoie un email de bienvenue à un nouvel agent avec ses identifiants.
 * Utilise Resend comme service d'envoi d'email.
 *
 * Variables d'environnement requises :
 * - RESEND_API_KEY : Clé API Resend
 * - RESEND_FROM_EMAIL : Email expéditeur (ex: noreply@kauri.com)
 */
export const sendWelcomeEmail = action({
  args: {
    toEmail: v.string(),
    agentName: v.string(),
    temporaryPassword: v.string(),
    branchName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@resend.dev'

    if (!apiKey) {
      throw new Error("Service email non configuré. Veuillez contacter l'administrateur.")
    }

    const subject = 'Bienvenue dans votre espace agent - Vos identifiants'

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #D85A30 0%, #993C1D 100%);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 12px 12px 0 0;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      background: #ffffff;
      padding: 30px;
      border: 1px solid #e5e5e5;
      border-top: none;
    }
    .credentials {
      background: #f9f9f9;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .credential-item {
      margin: 12px 0;
    }
    .credential-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .credential-value {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a18;
      font-family: 'Courier New', monospace;
      background: white;
      padding: 8px 12px;
      border-radius: 4px;
      border: 1px solid #e5e5e5;
    }
    .warning {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 16px;
      margin: 20px 0;
      color: #92400e;
      font-size: 14px;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #666;
      font-size: 12px;
    }
    .button {
      display: inline-block;
      background: #D85A30;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Bienvenue ${args.agentName} !</h1>
  </div>
  
  <div class="content">
    <p>Bonjour ${args.agentName},</p>
    
    <p>✅Votre compte agent a été créé avec succès${args.branchName ? ` pour la micro-finance <strong>${args.branchName}</strong>` : ''}. Voici vos identifiants de connexion :</p>
    
    <div class="credentials">
      <div class="credential-item">
        <div class="credential-label">Email</div>
        <div class="credential-value">${args.toEmail}</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">Mot de passe temporaire</div>
        <div class="credential-value">${args.temporaryPassword}</div>
      </div>
    </div>
    
    <div class="warning">
      <strong>⚠️ Important :</strong> Ce mot de passe est temporaire. Vous devrez le changer lors de votre première connexion pour des raisons de sécurité.
    </div>
    
    <p><strong>Prochaines étapes :</strong></p>
    <ol>
      <li>Ouvrez l'application mobile <strong>TontiPro</strong> sur votre TPE</li>
      <li>Connectez-vous avec l'email et le mot de passe ci-dessus</li>
      <li>Changez votre mot de passe lorsque vous y serez invité</li>
      <li>Commencez à utiliser l'application !</li>
    </ol>
    
    <p>Si vous rencontrez des problèmes, contactez votre responsable d'agence.</p>
    
    <p>Cordialement,<br>L'équipe Kauri</p>
  </div>
  
  <div class="footer">
    <p>Cet email a été envoyé automatiquement. Merci de ne pas y répondre.</p>
    <p>© ${new Date().getFullYear()} Kauri - Gestion d'épargne</p>
  </div>
</body>
</html>
    `

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [args.toEmail],
          subject,
          html: htmlContent,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Erreur lors de l'envoi de l'email: ${error}`)
      }

      const result = await response.json()
      return { success: true, emailId: result.id }
    } catch (error) {
      throw error
    }
  },
})
