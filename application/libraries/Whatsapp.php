<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Whatsapp
{
    protected $CI;
    protected $apiUrl;

    public function __construct()
    {
        $this->CI =& get_instance();
        // Assuming the Node.js service runs on localhost:3000
        $this->apiUrl = 'http://localhost:3000';
    }

    public function enviarMensagem($numero, $mensagem)
    {
        if (empty($numero) || empty($mensagem)) {
            return false;
        }

        $url = $this->apiUrl . '/send';
        $data = [
            'number' => $numero,
            'message' => $mensagem
        ];

        return $this->sendRequest($url, $data);
    }

    public function enviarMedia($numero, $mensagem, $arquivoPath, $nomeArquivo = null)
    {
        if (empty($numero) || !file_exists($arquivoPath)) {
            return false;
        }

        $url = $this->apiUrl . '/send';
        $data = [
            'number' => $numero,
            'message' => $mensagem,
            'originalBase64' => base64_encode(file_get_contents($arquivoPath)),
            'fileName' => $nomeArquivo
        ];

        return $this->sendRequest($url, $data);
    }

    private function sendRequest($url, $data)
    {
        $ch = curl_init($url);
        
        $payload = json_encode($data);

        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type:application/json'));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10); // Timeout of 10 seconds

        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        
        curl_close($ch);

        if ($httpCode >= 200 && $httpCode < 300) {
            $response = json_decode($result, true);
            if (isset($response['success']) && $response['success']) {
                return ['result' => true, 'message' => 'Mensagem enviada com sucesso!'];
            }
            return ['result' => false, 'message' => isset($response['error']) ? $response['error'] : 'Erro desconhecido no envio.'];
        } else {
            log_message('error', 'Whatsapp API Error: ' . $result);
            return ['result' => false, 'message' => 'Erro na comunicação com a API do WhatsApp.'];
        }
    }
}
