package com.metaagent.platform.domain.agent.service;

import com.metaagent.platform.domain.agent.entity.AgentWebsite;
import com.metaagent.platform.domain.agent.entity.AgentWebsitePage;
import com.metaagent.platform.domain.agent.repository.AgentWebsitePageRepository;
import com.metaagent.platform.domain.agent.repository.AgentWebsiteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.URL;
import java.net.URLConnection;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Runs website crawl asynchronously, in its own transaction, after the caller's transaction commits.
 * Separated from AgentService to allow Spring's proxy to apply @Async + @Transactional correctly.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WebsiteCrawlService {

    private static final int MAX_CRAWL_PAGES = 20;

    private final AgentWebsiteRepository agentWebsiteRepository;
    private final AgentWebsitePageRepository agentWebsitePageRepository;

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void crawl(AgentWebsite website) {
        log.info("Starting local crawl for URL: {}", website.getUrl());
        website.setCrawlStatus("in_progress");
        agentWebsiteRepository.save(website);

        Set<String> visitedUrls = new HashSet<>();
        Queue<String> queue = new LinkedList<>();

        String rootUrl = website.getUrl();
        queue.add(rootUrl);
        visitedUrls.add(rootUrl);

        try {
            String domain = new URI(rootUrl).getHost();

            while (!queue.isEmpty() && visitedUrls.size() <= MAX_CRAWL_PAGES) {
                String currentUrl = queue.poll();
                try {
                    String htmlContent = fetchHtml(currentUrl);
                    String title = extractTitle(htmlContent);
                    String text = extractText(htmlContent);

                    AgentWebsitePage page = AgentWebsitePage.builder()
                            .accountId(website.getAccountId())
                            .websiteId(website.getId())
                            .agentId(website.getAgentId())
                            .url(currentUrl)
                            .title(title)
                            .contentText(text)
                            .build();
                    agentWebsitePageRepository.save(page);

                    if (visitedUrls.size() < MAX_CRAWL_PAGES) {
                        List<String> links = extractLinks(htmlContent, currentUrl, domain);
                        for (String link : links) {
                            if (!visitedUrls.contains(link) && visitedUrls.size() < MAX_CRAWL_PAGES) {
                                visitedUrls.add(link);
                                queue.add(link);
                            }
                        }
                    }
                } catch (Exception e) {
                    log.warn("Failed to crawl page: {} - Error: {}", currentUrl, e.getMessage());
                }
            }

            website.setCrawlStatus("completed");
            website.setPagesCrawled(visitedUrls.size());
            website.setLastCrawledAt(LocalDateTime.now());
            agentWebsiteRepository.save(website);
            log.info("Completed local crawl for website ID {}. Crawled {} pages.", website.getId(), visitedUrls.size());

        } catch (Exception e) {
            log.error("Fatal error during crawl task for website ID: {}", website.getId(), e);
            website.setCrawlStatus("failed");
            agentWebsiteRepository.save(website);
        }
    }

    private String fetchHtml(String urlString) throws Exception {
        URL url = new URI(urlString).toURL();
        URLConnection conn = url.openConnection();
        conn.setRequestProperty("User-Agent", "MetaAgentPlatformCrawler/1.0");
        conn.setConnectTimeout(5000);
        conn.setReadTimeout(5000);

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()))) {
            return reader.lines().collect(Collectors.joining("\n"));
        }
    }

    private String extractTitle(String html) {
        Pattern titlePattern = Pattern.compile("<title>(.*?)</title>", Pattern.CASE_INSENSITIVE);
        Matcher matcher = titlePattern.matcher(html);
        if (matcher.find()) {
            return matcher.group(1).trim();
        }
        return "Untitled Page";
    }

    private String extractText(String html) {
        String cleanHtml = html.replaceAll("(?s)<script.*?>.*?</script>", "")
                             .replaceAll("(?s)<style.*?>.*?</style>", "");
        String text = cleanHtml.replaceAll("<[^>]*>", " ");
        return text.replaceAll("\\s+", " ").trim();
    }

    private List<String> extractLinks(String html, String baseUrlString, String domain) {
        List<String> links = new ArrayList<>();
        Pattern linkPattern = Pattern.compile("href=\"([^\"]+)\"", Pattern.CASE_INSENSITIVE);
        Matcher matcher = linkPattern.matcher(html);

        try {
            URI baseUri = new URI(baseUrlString);
            while (matcher.find()) {
                String href = matcher.group(1).trim();
                URI resolvedUri = baseUri.resolve(href);
                String resolvedUrl = resolvedUri.toString();

                if (resolvedUri.getHost() != null && resolvedUri.getHost().equals(domain)) {
                    int anchorIndex = resolvedUrl.indexOf("#");
                    if (anchorIndex != -1) {
                        resolvedUrl = resolvedUrl.substring(0, anchorIndex);
                    }
                    if (resolvedUrl.startsWith("http")) {
                        links.add(resolvedUrl);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Failed resolving links for base {}: {}", baseUrlString, e.getMessage());
        }
        return links;
    }
}
