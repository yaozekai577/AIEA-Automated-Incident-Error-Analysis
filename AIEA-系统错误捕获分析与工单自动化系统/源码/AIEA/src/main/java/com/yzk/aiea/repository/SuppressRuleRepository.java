package com.yzk.aiea.repository;

import com.yzk.aiea.entity.SuppressRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SuppressRuleRepository extends JpaRepository<SuppressRule, String> {
}
