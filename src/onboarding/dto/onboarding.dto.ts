import { IsString, IsNumber, IsArray, IsOptional, IsBoolean, IsObject, ValidateNested, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class BudgetDto {
  @IsNumber()
  @Min(0)
  min: number;

  @IsNumber()
  @Min(0)
  max: number;

  @IsString()
  currency: string;
}

export class PropertyPreferencesDto {
  @IsArray()
  @IsString({ each: true })
  propertyType: string[];

  @ValidateNested()
  @Type(() => BudgetDto)
  budget: BudgetDto;

  @IsArray()
  @IsString({ each: true })
  location: string[];

  @IsArray()
  @IsNumber({}, { each: true })
  bedrooms: number[];

  @IsArray()
  @IsNumber({}, { each: true })
  bathrooms: number[];

  @IsArray()
  @IsString({ each: true })
  features: string[];
}

export class AgentPreferencesDto {
  @IsString()
  licenseNumber: string;

  @IsString()
  agency: string;

  @IsNumber()
  @Min(0)
  @Max(50)
  experience: number;

  @IsArray()
  @IsString({ each: true })
  specializations: string[];

  @IsArray()
  @IsString({ each: true })
  serviceAreas: string[];
}

export class UpdateOnboardingStepDto {
  @IsNumber()
  @Min(1)
  currentStep: number;

  @IsString()
  stepName: string;

  @IsOptional()
  @IsObject()
  propertyPreferences?: PropertyPreferencesDto;

  @IsOptional()
  @IsObject()
  agentPreferences?: AgentPreferencesDto;
}

export class CompleteOnboardingDto {
  @IsBoolean()
  isCompleted: boolean;

  @IsOptional()
  @IsObject()
  propertyPreferences?: PropertyPreferencesDto;

  @IsOptional()
  @IsObject()
  agentPreferences?: AgentPreferencesDto;
}
