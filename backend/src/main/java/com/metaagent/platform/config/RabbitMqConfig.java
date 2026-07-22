package com.metaagent.platform.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMqConfig {

    public static final String EXCHANGE_NAME = "platform.events";
    public static final String DLX_EXCHANGE_NAME = "platform.events.dlx";

    public static final String WEBHOOK_QUEUE = "webhook-processing";
    public static final String WEBHOOK_ROUTING_KEY = "webhook.received";
    public static final String WEBHOOK_DLQ = "dlq.webhook-failed";

    public static final String ANALYTICS_QUEUE = "analytics-ingest";
    public static final String ANALYTICS_ROUTING_KEY = "message.sent";
    public static final String ANALYTICS_DLQ = "dlq.analytics-failed";

    @Bean
    public TopicExchange eventExchange() {
        return new TopicExchange(EXCHANGE_NAME);
    }

    @Bean
    public TopicExchange deadLetterExchange() {
        return new TopicExchange(DLX_EXCHANGE_NAME);
    }

    @Bean
    public Queue webhookQueue() {
        return QueueBuilder.durable(WEBHOOK_QUEUE)
                .withArgument("x-dead-letter-exchange", DLX_EXCHANGE_NAME)
                .withArgument("x-dead-letter-routing-key", WEBHOOK_DLQ)
                .build();
    }

    @Bean
    public Queue webhookDlq() {
        return new Queue(WEBHOOK_DLQ);
    }

    @Bean
    public Binding webhookBinding(Queue webhookQueue, TopicExchange eventExchange) {
        return BindingBuilder.bind(webhookQueue).to(eventExchange).with(WEBHOOK_ROUTING_KEY);
    }

    @Bean
    public Binding webhookDlqBinding(Queue webhookDlq, TopicExchange deadLetterExchange) {
        return BindingBuilder.bind(webhookDlq).to(deadLetterExchange).with(WEBHOOK_DLQ);
    }

    @Bean
    public Queue analyticsQueue() {
        return QueueBuilder.durable(ANALYTICS_QUEUE)
                .withArgument("x-dead-letter-exchange", DLX_EXCHANGE_NAME)
                .withArgument("x-dead-letter-routing-key", ANALYTICS_DLQ)
                .build();
    }

    @Bean
    public Queue analyticsDlq() {
        return new Queue(ANALYTICS_DLQ);
    }

    @Bean
    public Binding analyticsBinding(Queue analyticsQueue, TopicExchange eventExchange) {
        return BindingBuilder.bind(analyticsQueue).to(eventExchange).with(ANALYTICS_ROUTING_KEY);
    }

    @Bean
    public Binding analyticsDlqBinding(Queue analyticsDlq, TopicExchange deadLetterExchange) {
        return BindingBuilder.bind(analyticsDlq).to(deadLetterExchange).with(ANALYTICS_DLQ);
    }

    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }
}
