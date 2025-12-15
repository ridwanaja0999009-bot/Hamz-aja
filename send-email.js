// File: api/send-email.js

import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // 1. Cek Method HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({
      status: 'error',
      message: '❌ Method tidak diizinkan. Hanya POST yang diperbolehkan.'
    });
  }

  // 2. Validasi API Key
  const apiKey = req.headers['x-api-key'];
  // API_KEY diambil dari Environment Variable di Vercel Dashboard
  const validApiKey = process.env.API_KEY; 

  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({
      status: 'error',
      message: '🔐 API Key tidak valid atau tidak ditemukan. Pastikan API_KEY Vercel sesuai.'
    });
  }

  // 3. Destructuring dan Validasi Data Wajib
  const { 
      to_email, 
      subject, 
      body, 
      number, 
      user_id, 
      username,
      sender_user, // Dinamis dari Bot
      sender_pass  // Dinamis dari Bot (App Password)
  } = req.body;

  // Pastikan data esensial untuk pengiriman dan kredensial ada
  if (!to_email || !subject || !body || !number || !sender_user || !sender_pass) {
    // Log error lengkap di server Vercel untuk debugging
    console.error('❌ Data Request Tidak Lengkap:', req.body);
    
    return res.status(400).json({
      status: 'error',
      message: '📝 Data request tidak lengkap. Cek to_email, subject, body, number, sender_user, dan sender_pass.'
    });
  }

  try {
    // 4. Konfigurasi Transporter dengan Kredensial Dinamis
    // Kredensial ini datang dari database Multi-Sender Bot
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // TLS requires secure: false
      requireTLS: true,
      auth: {
        user: sender_user, 
        pass: sender_pass  
      },
      // Settings untuk mencegah timeout
      timeout: 30000,
      connectionTimeout: 30000,
      socketTimeout: 30000,
      tls: {
        rejectUnauthorized: false
      }
    });

    // 5. Kirim Email
    const mailOptions = {
      from: sender_user, 
      to: to_email,
      subject: subject,
      text: body,
      html: body.replace(/\n/g, '<br>')
    };

    const info = await transporter.sendMail(mailOptions);

    // 6. Log dan Respons Sukses
    console.log('✅ Email berhasil dikirim:', {
      messageId: info.messageId,
      to: to_email,
      subject: subject,
      sender: sender_user, 
    });

    return res.status(200).json({
      status: 'success',
      message: '🎉 Email berhasil dikirim!',
      data: {
        message_id: info.messageId,
        to_email: to_email,
        subject: subject,
        sender_user: sender_user
      }
    });

  } catch (error) {
    // 7. Log dan Respons Gagal
    // Logging error yang detail di sisi Vercel
    console.error('🔥 KRITIS: Error Nodemailer/SMTP (Sender: %s):', sender_user, error);
    
    // Memberikan pesan error yang jelas kembali ke Bot
    let errorMessage = `❌ Gagal mengirim email (Kode: ${error.code || 'N/A'}). `;
    if (error.code === 'EAUTH') {
        errorMessage += 'Otentikasi Gmail Gagal. Cek App Password/Email.';
    } else if (error.code === 'EENVELOPE') {
        errorMessage += 'Alamat Tujuan tidak valid.';
    } else {
        errorMessage += 'Masalah Server/Koneksi SMTP.';
    }

    // Pastikan respons yang dikirim adalah JSON
    return res.status(500).json({
      status: 'error',
      message: errorMessage,
      error_code: error.code || 'EMAIL_SEND_FAILED',
      error_details: error.message
    });
  }
}
