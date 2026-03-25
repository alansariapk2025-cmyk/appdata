// utils/sendOrderEmail.js
import emailjs from 'emailjs-com';

export const sendOrderEmail = (orderData) => {
  return emailjs.send(
    'service_6m8g7wy',           // Your Service ID
    'template_auhtyhf',          // Your Template ID
    {
      customer_name: orderData.name,
      order_id: orderData.orderId,
      order_date: orderData.date,
      total_amount: orderData.total,
      itemsHtml: orderData.itemsHtml,
    },
    'KAzG2w9j-AV9axZ4q'          // Your Public Key
  );
};
