let isEnglish = false;
const workerEndpoint = ''https://avfun.org/api/ip-check'';
let turnstileToken = null;
let queryCount = 0;

const sanitizeInput = (input) => {
    return input.replace(/[^a-zA-Z0-9.:\/]/g, '').substring(0, 100);
};

function onVerify(token) {
    turnstileToken = token;
    document.getElementById('scanBtn').disabled = false;
}

const initApp = () => {
    const updateLang = () => {
        document.querySelectorAll('[data-zh], [data-placeholder-zh]').forEach(el => {
            if(el.tagName === 'TITLE') {
                document.title = isEnglish ? el.dataset.en : el.dataset.zh;
                return;
            }
            
            if(el.tagName === 'INPUT') {
                el.placeholder = isEnglish ? el.dataset.placeholderEn : el.dataset.placeholderZh;
            } else {
                el.textContent = isEnglish ? el.dataset.en : el.dataset.zh;
            }
        });

        document.querySelector('meta[name="description"]').content = isEnglish 
            ? document.querySelector('meta[name="description"]').dataset.en
            : document.querySelector('meta[name="description"]').dataset.zh;

        document.querySelector('meta[name="keywords"]').content = isEnglish 
            ? document.querySelector('meta[name="keywords"]').dataset.en
            : document.querySelector('meta[name="keywords"]').dataset.zh;

        document.querySelector('meta[property="og:title"]').content = isEnglish 
            ? document.querySelector('meta[property="og:title"]').dataset.en
            : document.querySelector('meta[property="og:title"]').dataset.zh;
    };

    // 修复logo点击事件
    document.getElementById('logoLink').addEventListener('click', () => {
        window.location.reload();
    });

    document.getElementById('scanBtn').addEventListener('click', async () => {
        if (!turnstileToken) {
            showError(isEnglish ? '请完成验证' : 'Complete verification');
            return;
        }
        
        const rawInput = document.getElementById('ipInput').value.trim();
        const cleanInput = sanitizeInput(rawInput);
        if (!cleanInput) {
            showError(isEnglish ? 'Invalid input' : '输入内容无效');
            return;
        }
        
        const btn = document.getElementById('scanBtn');
        btn.style.opacity = '0.8';
        try {
            const response = await fetch(`${workerEndpoint}?q=${btoa(encodeURIComponent(cleanInput))}`, {
                headers: {
                    'CF-Turnstile-Token': turnstileToken
                }
            });
            
            if (!response.ok) throw new Error();
            
            const data = await response.json();
            processData(data);
            queryCount++;
            if(queryCount >= 3) showExpertModal();
        } catch (error) {
            showError(isEnglish ? 'Service unavailable' : '服务暂时不可用');
        } finally {
            btn.style.opacity = '1';
        }
    });

    // 修复翻译按钮功能
    document.getElementById('langBtn').addEventListener('click', () => {
        isEnglish = !isEnglish;
        updateLang();
        if(document.getElementById('riskValue').innerHTML) {
            const data = JSON.parse(document.getElementById('riskValue').dataset.raw || '{}');
            processData(data);
        }
    });

    document.querySelectorAll('.share-btn').forEach(btn => {
        btn.addEventListener('click', handleShare);
    });

    document.getElementById('modalClose').addEventListener('click', () => {
        document.getElementById('expertModal').style.display = 'none';
    });

    document.querySelector('.copy-referral').addEventListener('click', () => {
        navigator.clipboard.writeText(document.getElementById('referralLink').value);
        showError(isEnglish ? '已复制' : 'Copied');
    });

    updateLang();
};

function showError(message) {
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function processData(data) {
    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value || 'N/A';
    };

    setValue('ipValue', data.ip);
    setValue('locationValue', `${data.country || '未知'} · ${data.city || '未知'}`);
    setValue('asnValue', data.asn ? `AS${data.asn}` : 'N/A');
    setValue('asnOwnerValue', data.isp);

    const ipTypeElement = document.getElementById('ipTypeValue');
    ipTypeElement.textContent = isEnglish ? 
        (data.isIDC ? 'IDC IP' : 'Residential IP') 
        : (data.isIDC ? 'IDC机房IP' : '家庭宽带IP');
    ipTypeElement.style.color = data.isIDC ? '#e74c3c' : '#2ecc71';

    const nativeIpElement = document.getElementById('nativeIpValue');
    const isNative = !/(aws|gcp|azure)/i.test(data.isp);
    nativeIpElement.textContent = isEnglish ? 
        (isNative ? 'Yes' : 'No') 
        : (isNative ? '是' : '否');
    nativeIpElement.style.color = isNative ? '#2ecc71' : '#e74c3c';

    const riskLevelColor = data.isMalicious ? '#e74c3c' : 
                         data.isIDC ? '#f1c40f' : '#2ecc71';
    
    const riskHtml = `
        <div class="risk-info">
            <div style="display:flex;align-items:center">
                <span class="risk-dot"></span>
                <span class="risk-text" style="color:${riskLevelColor}">${isEnglish ? 'Risk Level' : '网络等级'}</span>
                <span class="risk-value" style="color:${riskLevelColor}">${data.riskScore}/100</span>
            </div>
            <div class="risk-components">
                <div class="risk-item">
                    <label>${isEnglish ? 'Reputation' : '历史信誉'}</label>
                    <div class="progress-bar">
                        <div class="progress" style="width:${data.riskComponents.reputation}%"></div>
                    </div>
                    <span>${data.riskComponents.reputation}</span>
                </div>
                <div class="risk-item">
                    <label>${isEnglish ? 'Frequency' : '请求频率'}</label>
                    <div class="progress-bar">
                        <div class="progress" style="width:${data.riskComponents.frequency}%"></div>
                    </div>
                    <span>${data.riskComponents.frequency}</span>
                </div>
                <div class="risk-item">
                    <label>${isEnglish ? 'Geo Risk' : '地理风险'}</label>
                    <div class="progress-bar">
                        <div class="progress" style="width:${data.riskComponents.geoRisk}%"></div>
                    </div>
                    <span>${data.riskComponents.geoRisk}</span>
                </div>
            </div>
        </div>
    `;
    document.getElementById('riskValue').innerHTML = riskHtml;
    document.getElementById('riskValue').dataset.raw = JSON.stringify(data);

    const riskDot = document.querySelector('.risk-dot');
    if(data.isMalicious) {
        riskDot.style.background = '#e74c3c';
    } else {
        riskDot.style.background = data.isIDC ? '#f1c40f' : '#2ecc71';
    }

    document.getElementById('locationValue').insertAdjacentHTML('beforeend', 
        `<span class="risk-flag" style="background:${data.geoRiskColor}">${data.geoRiskLabel}</span>`);

    if (data.isIDC) {
        ipTypeElement.insertAdjacentHTML('afterend', 
            `<div class="risk-flag">${isEnglish ? 'IDC Alert' : 'IDC机房警告'}</div>`);
    }

    document.getElementById('promotionBanner').style.display = data.isIDC || data.isCloud ? 'block' : 'none';
    document.getElementById('providerGrid').innerHTML = data.providers.map(p => `
        <div class="provider-card">
            <h4>${p.name}</h4>
            <a href="${p.link}?ref=avfun" target="_blank" class="promo-link">
                ${isEnglish ? 'Get Offer' : '立即优惠'}
            </a>
        </div>
    `).join('');

    document.getElementById('sharePanel').style.display = 'flex';
    setValue('nativeIpValue', isEnglish ? (isNative ? 'Yes' : 'No') : (isNative ? '是' : '否'));

    document.getElementById('resultPanel').style.display = 'block';
    document.querySelectorAll('.info-row').forEach(row => {
        row.style.animation = 'cardAppear 0.6s ease';
    });
}

function handleShare(event) {
    const platform = event.target.dataset.platform;
    const currentUrl = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`${isEnglish ? 'Check my IP info' : '查看我的IP信息'} #IPCheck`);
    
    const shareUrls = {
        github: `https://github.com/intent/tweet?text=${text}&url=${currentUrl}`,
        x: `https://x.com/intent/tweet?text=${text}&url=${currentUrl}`,
        telegram: `https://t.me/share/url?url=${currentUrl}&text=${text}`,
        weibo: `https://service.weibo.com/share/share.php?url=${currentUrl}&title=${text}`,
        wechat: 'javascript:alert("请使用微信扫一扫分享")'
    };

    if (platform === 'copy') {
        navigator.clipboard.writeText(window.location.href);
        showError(isEnglish ? '链接已复制' : 'Link copied');
    } else {
        window.open(shareUrls[platform], '_blank');
    }
}

function showExpertModal() {
    document.getElementById('expertModal').style.display = 'block';
    document.getElementById('referralLink').value = `${window.location.origin}?ref=${btoa(localStorage.getItem('userToken'))}`;
}

document.addEventListener('DOMContentLoaded', initApp);

document.head.insertAdjacentHTML('beforeend', `
<style>
@keyframes cardAppear {
    0% { opacity: 0; transform: scale(0.95); }
    100% { opacity: 1; transform: scale(1); }
}
</style>
`);
