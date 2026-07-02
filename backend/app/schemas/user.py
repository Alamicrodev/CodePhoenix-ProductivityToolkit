from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserResponse(BaseModel):
    id: str
    email: EmailStr               #pydantic inbuilt email validation
    full_name: str
    created_at: datetime

    model_config = {"from_attributes": True}    #tells pydantic, this model can be used to validate objects(with attributes) 
                                                #and not just some dictionary values.
