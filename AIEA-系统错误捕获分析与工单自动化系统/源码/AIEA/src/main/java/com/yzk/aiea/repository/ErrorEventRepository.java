package com.yzk.aiea.repository;

import com.yzk.aiea.entity.ErrorEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ErrorEventRepository extends JpaRepository<ErrorEvent, Long> {

    /** 根据指纹查询所有同指纹事件 */
    List<ErrorEvent> findByFingerprint(String fingerprint);

    /** 根据状态查询 */
    List<ErrorEvent> findByStatus(String status);
}
