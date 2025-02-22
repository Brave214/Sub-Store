import { FILES_KEY, MODULES_KEY } from '@/constants';
import { findByName } from '@/utils/database';
import { HTTP, ENV } from '@/vendor/open-api';
import { hex_md5 } from '@/vendor/md5';
import resourceCache from '@/utils/resource-cache';
import $ from '@/core/app';

const tasks = new Map();

export default async function download(url, ua) {
    const downloadUrlMatch = url.match(/^\/api\/(file|module)\/(.+)/);
    if (downloadUrlMatch) {
        let type = downloadUrlMatch?.[1];
        let name = downloadUrlMatch?.[2];
        if (name == null) {
            throw new Error(`本地 ${type} URL 无效: ${url}`);
        }
        name = decodeURIComponent(name);
        const key = type === 'module' ? MODULES_KEY : FILES_KEY;
        const item = findByName($.read(key), name);
        if (!item) {
            throw new Error(`找不到本地 ${type}: ${name}`);
        }

        return item.content;
    }

    const { isNode } = ENV();
    ua = ua || 'Quantumult%20X/1.0.29 (iPhone14,5; iOS 15.4.1)';
    const id = hex_md5(ua + url);
    if (!isNode && tasks.has(id)) {
        return tasks.get(id);
    }

    const http = HTTP({
        headers: {
            'User-Agent': ua,
        },
    });

    const result = new Promise((resolve, reject) => {
        // try to find in app cache
        const cached = resourceCache.get(id);
        if (cached) {
            resolve(cached);
        } else {
            http.get(url)
                .then((resp) => {
                    const body = resp.body;
                    if (body.replace(/\s/g, '').length === 0)
                        reject(new Error('远程资源内容为空！'));
                    else {
                        resourceCache.set(id, body);
                        resolve(body);
                    }
                })
                .catch(() => {
                    reject(new Error(`无法下载 URL：${url}`));
                });
        }
    });

    if (!isNode) {
        tasks.set(id, result);
    }
    return result;
}
