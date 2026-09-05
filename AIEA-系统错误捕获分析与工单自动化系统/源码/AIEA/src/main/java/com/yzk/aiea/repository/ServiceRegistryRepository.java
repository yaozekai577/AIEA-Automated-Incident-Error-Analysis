package com.yzk.aiea.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.yzk.aiea.entity.ServiceRegistry;

@Repository
public interface ServiceRegistryRepository extends JpaRepository<ServiceRegistry, Long> {

    /** 按服务名查找 */
    Optional<ServiceRegistry> findByService(String service);

    /** 按服务名 + Token 查找（鉴权用） */
    Optional<ServiceRegistry> findByServiceAndApiToken(String service, String apiToken);

    /** 服务名是否已存在 */
    boolean existsByService(String service);
}
