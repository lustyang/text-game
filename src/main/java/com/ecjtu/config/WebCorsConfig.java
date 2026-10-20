package com.ecjtu.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 跨域配置（开发和演示用）。
 *
 * 为什么需要它：
 *   页面如果不由 Spring Boot 托管（比如 VSCode Live Server、直接双击 html），
 *   或者通过内网穿透（ngrok / cpolar / frp）访问，浏览器就会把请求当成跨域。
 *   而登录依赖 JSESSIONID 这个 Cookie，必须显式放行 + 允许携带凭证。
 *
 * 为什么用 "*" 而不是白名单：
 *   浏览器对 POST 请求一定会带 Origin 头（同源也带），而 Spring 的 CORS 处理
 *   只看「有没有 Origin 头」，不看是否真的跨域。所以只要配了 CORS 但 Origin
 *   不在白名单里，就会被 DefaultCorsProcessor 直接拒绝成 403。
 *   内网穿透的域名每次重启都会变（ngrok 免费版就是随机的），白名单必然导致
 *   登录 403，所以这里放行所有来源。
 *
 * ⚠️ 上线到公网时请改成自己的域名白名单，例如：
 *      .allowedOriginPatterns("https://your-domain.com")
 */
@Configuration
public class WebCorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns("*")   // 配合 allowCredentials(true) 时会回显真实 Origin
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)       // 关键：允许携带 JSESSIONID，否则登录态存不住
                .maxAge(3600);
    }
}
