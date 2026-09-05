package com.yzk.aiea.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.yzk.aiea.entity.NotifyRouting;

@Repository
public interface NotifyRoutingRepository extends JpaRepository<NotifyRouting, Long> {

    /** 按服务名 + 渠道查找路由规则 */
    Optional<NotifyRouting> findByServiceAndChannel(String service, String channel);

    /** 服务名 + 渠道是否已存在 */
    boolean existsByServiceAndChannel(String service, String channel);
}
