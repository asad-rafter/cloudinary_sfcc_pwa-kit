/*
 * Copyright (c) 2024, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * This file is responsible for integrating with the Marketing Cloud APIs to
 * send emails with a magic link to a specified contact using the Marketing Cloud API.
 * For this integration to work, a template email with a `%%magic-link%%` personalization string inserted
 * must exist in your Marketing Cloud org.
 *
 * More details here: https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/transactional-messaging-get-started.html
 *
 * High Level Flow:
 * 1. It retrieves an access token from the Marketing Cloud API using the
 *    provided client ID and client secret.
 * 2. It constructs the email message URL using the generated unique ID and the
 *    provided template ID.
 * 3. It sends the email message containing the magic link to the specified contact
 *    using the Marketing Cloud API.
 */

import crypto from 'crypto'

/**
 * Tokens are valid for 20 minutes. We store it at the top level scope to reuse
 * it during the lambda invocation. We'll refresh it after 15 minutes.
 */
let marketingCloudToken = ''
let marketingCloudTokenExpiration = new Date()

/**
 * Generates a unique ID for the email message.
 *
 * @return {string} A unique ID for the email message.
 */
function generateUniqueId() {
    return crypto.randomBytes(16).toString('hex')
}

/**
 * Sends an email to a specified contact using the Marketing Cloud API. The template email must have a
 * `%%magic-link%%` personalization string inserted.
 * https://help.salesforce.com/s/articleView?id=mktg.mc_es_personalization_strings.htm&type=5
 *
 * @param {string} email - The email address of the contact to whom the email will be sent.
 * @param {string} templateId - The ID of the email template to be used for the email.
 * @param {string} magicLink - The magic link to be included in the email.
 *
 * @return {Promise<object>} A promise that resolves to the response object received from the Marketing Cloud API.
 */
async function sendMarketingCloudEmail(emailId, marketingCloudConfig) {
    // Refresh token if expired
    if (new Date() > marketingCloudTokenExpiration) {
        const {clientId, clientSecret, subdomain} = marketingCloudConfig
        const tokenUrl = `https://${subdomain}.auth.marketingcloudapis.com/v2/token`
        const tokenResponse = await fetch(tokenUrl, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                grant_type: 'client_credentials',
                client_id: clientId,
                client_secret: clientSecret
            })
        })

        if (!tokenResponse.ok)
            throw new Error(
                'Failed to fetch Marketing Cloud access token. Check your Marketing Cloud credentials and try again.'
            )

        const {access_token} = await tokenResponse.json()
        marketingCloudToken = access_token
        // Set expiration to 15 mins
        marketingCloudTokenExpiration = new Date(Date.now() + 15 * 60 * 1000)
    }

    // Send the email
    const emailUrl = `https://${
        marketingCloudConfig.subdomain
    }.rest.marketingcloudapis.com/messaging/v1/email/messages/${generateUniqueId()}`
    const emailResponse = await fetch(emailUrl, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${marketingCloudToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            definitionKey: marketingCloudConfig.templateId,
            recipient: {
                contactKey: emailId,
                to: emailId,
                attributes: {'magic-link': marketingCloudConfig.magicLink}
            }
        })
    })

    if (!emailResponse.ok) throw new Error('Failed to send email to Marketing Cloud')

    return await emailResponse.json()
}

/**
 * Generates a unique ID, constructs an email message URL, and sends the email to the specified contact
 * using the Marketing Cloud API.
 *
 * @param {string} email - The email address of the contact to whom the email will be sent.
 * @param {string} templateId - The ID of the email template to be used for the email.
 * @param {string} magicLink - The magic link to be included in the email.
 *
 * @return {Promise<object>} A promise that resolves to the response object received from the Marketing Cloud API.
 */
export async function emailLink(emailId, templateId, magicLink) {
    if (!process.env.MARKETING_CLOUD_CLIENT_ID) {
        console.warn('MARKETING_CLOUD_CLIENT_ID is not set in the environment variables.')
    }

    if (!process.env.MARKETING_CLOUD_CLIENT_SECRET) {
        console.warn(' MARKETING_CLOUD_CLIENT_SECRET is not set in the environment variables.')
    }

    if (!process.env.MARKETING_CLOUD_SUBDOMAIN) {
        console.warn('MARKETING_CLOUD_SUBDOMAIN is not set in the environment variables.')
    }

    const marketingCloudConfig = {
        clientId: process.env.MARKETING_CLOUD_CLIENT_ID,
        clientSecret: process.env.MARKETING_CLOUD_CLIENT_SECRET,
        magicLink: magicLink,
        subdomain: process.env.MARKETING_CLOUD_SUBDOMAIN,
        templateId: templateId
    }
    return await sendMarketingCloudEmail(emailId, marketingCloudConfig)
}
