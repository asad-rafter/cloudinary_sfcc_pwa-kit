/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import React, {useState, useEffect} from 'react'
import PropTypes from 'prop-types'
import {defineMessage, FormattedMessage, useIntl} from 'react-intl'
import {
    Box,
    Button,
    Container,
    Heading,
    SimpleGrid,
    Stack
} from '@salesforce/retail-react-app/app/components/shared/ui'
import {useForm, Controller} from 'react-hook-form'
import {shallowEquals} from '@salesforce/retail-react-app/app/utils/utils'
import {RadioCard, RadioCardGroup} from '@salesforce/retail-react-app/app/components/radio-card'
import ActionCard from '@salesforce/retail-react-app/app/components/action-card'
import {PlusIcon} from '@salesforce/retail-react-app/app/components/icons'
import AddressDisplay from '@salesforce/retail-react-app/app/components/address-display'
import AddressFields from '@salesforce/retail-react-app/app/components/forms/address-fields'
import FormActionButtons from '@salesforce/retail-react-app/app/components/forms/form-action-buttons'
import {MESSAGE_PROPTYPE} from '@salesforce/retail-react-app/app/utils/locale'
import {useCurrentCustomer} from '@salesforce/retail-react-app/app/hooks/use-current-customer'
import {useShopperCustomersMutation} from '@salesforce/commerce-sdk-react'

const saveButtonMessage = defineMessage({
    defaultMessage: 'Save & Continue to Shipping Method',
    id: 'shipping_address_edit_form.button.save_and_continue'
})

const ShippingAddressEditForm = ({
    title,
    hasSavedAddresses,
    toggleAddressEdit,
    hideSubmitButton,
    form,
    submitButtonLabel,
    formTitleAriaLabel,
    isBillingAddress = false
}) => {
    const {formatMessage} = useIntl()

    return (
        <Box
            {...(hasSavedAddresses &&
                !isBillingAddress && {
                    gridColumn: [1, 1, 'span 2'],
                    paddingX: [4, 4, 6],
                    paddingY: 6,
                    rounded: 'base',
                    border: '1px solid',
                    borderColor: 'blue.600'
                })}
            data-testid="sf-shipping-address-edit-form"
        >
            <Stack spacing={6}>
                {hasSavedAddresses && !isBillingAddress && (
                    <Heading as="h3" size="sm">
                        {title}
                    </Heading>
                )}

                <Stack spacing={6}>
                    <AddressFields
                        form={form}
                        formTitleAriaLabel={formTitleAriaLabel}
                        isBillingAddress={isBillingAddress}
                    />

                    {hasSavedAddresses && !hideSubmitButton ? (
                        <FormActionButtons
                            saveButtonLabel={saveButtonMessage}
                            onCancel={toggleAddressEdit}
                        />
                    ) : (
                        !hideSubmitButton && (
                            <Box>
                                <Container variant="form">
                                    <Button
                                        type="submit"
                                        width="full"
                                        disabled={form.formState.isSubmitting}
                                    >
                                        {formatMessage(submitButtonLabel)}
                                    </Button>
                                </Container>
                            </Box>
                        )
                    )}
                </Stack>
            </Stack>
        </Box>
    )
}

ShippingAddressEditForm.propTypes = {
    title: PropTypes.string,
    hasSavedAddresses: PropTypes.bool,
    toggleAddressEdit: PropTypes.func,
    hideSubmitButton: PropTypes.bool,
    form: PropTypes.object,
    submitButtonLabel: MESSAGE_PROPTYPE,
    formTitleAriaLabel: MESSAGE_PROPTYPE,
    isBillingAddress: PropTypes.bool
}

const submitButtonMessage = defineMessage({
    defaultMessage: 'Submit',
    id: 'shipping_address_selection.button.submit'
})

const ShippingAddressSelection = ({
    form,
    selectedAddress,
    submitButtonLabel = submitButtonMessage,
    formTitleAriaLabel,
    hideSubmitButton = false,
    onSubmit = async () => null,
    isBillingAddress = false
}) => {
    const {formatMessage} = useIntl()
    const {data: customer, isLoading, isFetching} = useCurrentCustomer()
    const isLoadingRegisteredCustomer = isLoading && isFetching

    const hasSavedAddresses = customer.addresses?.length > 0
    const [isEditingAddress, setIsEditingAddress] = useState(false)
    const [selectedAddressId, setSelectedAddressId] = useState(undefined)

    // keep track of the edit buttons so we can focus on them later for accessibility
    const [editBtnRefs, setEditBtnRefs] = useState({})
    useEffect(() => {
        const currentRefs = {}
        customer.addresses?.forEach(({addressId}) => {
            currentRefs[addressId] = React.createRef()
        })
        setEditBtnRefs(currentRefs)
    }, [customer.addresses])

    const defaultForm = useForm({
        mode: 'onChange',
        shouldUnregister: false,
        defaultValues: {...selectedAddress}
    })
    if (!form) form = defaultForm

    const matchedAddress =
        hasSavedAddresses &&
        selectedAddress &&
        customer.addresses.find((savedAddress) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const {addressId, creationDate, lastModified, preferred, ...address} = savedAddress
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const {id, _type, ...selectedAddr} = selectedAddress
            return shallowEquals(address, selectedAddr)
        })
    const removeCustomerAddress = useShopperCustomersMutation('removeCustomerAddress')

    useEffect(() => {
        if (isBillingAddress) {
            form.reset({...selectedAddress})
            return
        }
        // Automatically select the customer's default/preferred shipping address
        if (customer.addresses) {
            const address = customer.addresses.find((addr) => addr.preferred === true)
            if (address) {
                form.reset({...address})
            }
        }
    }, [])

    useEffect(() => {
        // If the customer deletes all their saved addresses during checkout,
        // we need to make sure to display the address form.
        if (!isLoading && !customer?.addresses && !isEditingAddress) {
            setIsEditingAddress(true)
        }
    }, [customer])

    useEffect(() => {
        if (matchedAddress) {
            form.reset({
                addressId: matchedAddress.addressId,
                ...matchedAddress
            })
        }

        if (!matchedAddress && selectedAddressId) {
            setIsEditingAddress(true)
        }
    }, [matchedAddress])

    // Updates the selected customer address if we've an address selected
    // else saves a new customer address
    const submitForm = async (address) => {
        if (selectedAddressId) {
            address = {...address, addressId: selectedAddressId}
        }

        setIsEditingAddress(false)
        form.reset({addressId: ''})

        await onSubmit(address)
    }

    // Acts as our `onChange` handler for addressId radio group. We do this
    // manually here so we can toggle off the 'add address' form as needed.
    const handleAddressIdSelection = (addressId) => {
        if (addressId && isEditingAddress) {
            setIsEditingAddress(false)
        }

        const address = customer.addresses.find((addr) => addr.addressId === addressId)

        form.reset({...address})
    }

    const headingText = formatMessage({
        defaultMessage: 'Shipping Address',
        id: 'shipping_address.title.shipping_address'
    })
    const shippingAddressHeading = Array.from(document.querySelectorAll('h2')).find(
        (element) => element.textContent === headingText
    )

    const removeSavedAddress = async (addressId) => {
        if (addressId === selectedAddressId) {
            setSelectedAddressId(undefined)
            setIsEditingAddress(false)
            form.reset({addressId: ''})
        }

        await removeCustomerAddress.mutateAsync(
            {
                parameters: {
                    customerId: customer.customerId,
                    addressName: addressId
                }
            },
            {
                onSuccess: () => {
                    // Focus on header after successful remove for accessibility
                    shippingAddressHeading?.focus()
                }
            }
        )
    }

    // Opens/closes the 'add address' form. Notice that when toggling either state,
    // we reset the form so as to remove any address selection.
    const toggleAddressEdit = (address = undefined) => {
        if (address?.addressId) {
            setSelectedAddressId(address.addressId)
            form.reset({...address})
            setIsEditingAddress(true)
        } else {
            // Focus on the edit button that opened the form when the form closes
            // otherwise focus on the heading if we can't find the button
            const focusAfterClose =
                editBtnRefs[selectedAddressId]?.current ?? shippingAddressHeading
            focusAfterClose?.focus()
            setSelectedAddressId(undefined)
            form.reset({addressId: ''})
            setIsEditingAddress(!isEditingAddress)
        }

        form.trigger()
    }

    if (isLoadingRegisteredCustomer) {
        // Don't render anything yet, to make sure values like hasSavedAddresses are correct
        return null
    }
    return (
        <form onSubmit={form.handleSubmit(submitForm)}>
            <Stack spacing={4}>
                {hasSavedAddresses && !isBillingAddress && (
                    <Controller
                        name="addressId"
                        defaultValue=""
                        control={form.control}
                        rules={{required: !isEditingAddress}}
                        render={({field: {value}}) => (
                            <RadioCardGroup value={value} onChange={handleAddressIdSelection}>
                                <SimpleGrid
                                    columns={[1, 1, 2]}
                                    spacing={4}
                                    gridAutoFlow="row dense"
                                >
                                    {customer.addresses?.map((address, index) => {
                                        const editLabel = formatMessage(
                                            {
                                                defaultMessage: 'Edit {address}',
                                                id: 'shipping_address.label.edit_button'
                                            },
                                            {address: address.address1}
                                        )

                                        const removeLabel = formatMessage(
                                            {
                                                defaultMessage: 'Remove {address}',
                                                id: 'shipping_address.label.remove_button'
                                            },
                                            {address: address.address1}
                                        )
                                        return (
                                            <React.Fragment key={address.addressId}>
                                                <RadioCard value={address.addressId}>
                                                    <ActionCard
                                                        padding={0}
                                                        border="none"
                                                        onRemove={() =>
                                                            removeSavedAddress(address.addressId)
                                                        }
                                                        onEdit={() => toggleAddressEdit(address)}
                                                        editBtnRef={editBtnRefs[address.addressId]}
                                                        data-testid={`sf-checkout-shipping-address-${index}`}
                                                        editBtnLabel={editLabel}
                                                        removeBtnLabel={removeLabel}
                                                    >
                                                        <AddressDisplay address={address} />
                                                    </ActionCard>
                                                    {/*Arrow up icon pointing to the address that is being edited*/}
                                                    {isEditingAddress &&
                                                        address.addressId === selectedAddressId && (
                                                            <Box
                                                                width={3}
                                                                height={3}
                                                                borderLeft="1px solid"
                                                                borderTop="1px solid"
                                                                borderColor="blue.600"
                                                                position="absolute"
                                                                left="50%"
                                                                bottom="-23px"
                                                                background="white"
                                                                transform="rotate(45deg)"
                                                            />
                                                        )}
                                                </RadioCard>
                                                {isEditingAddress &&
                                                    address.addressId === selectedAddressId && (
                                                        <ShippingAddressEditForm
                                                            title={formatMessage({
                                                                defaultMessage:
                                                                    'Edit Shipping Address',
                                                                id: 'shipping_address_selection.title.edit_shipping'
                                                            })}
                                                            hasSavedAddresses={hasSavedAddresses}
                                                            toggleAddressEdit={toggleAddressEdit}
                                                            hideSubmitButton={hideSubmitButton}
                                                            form={form}
                                                            submitButtonLabel={submitButtonLabel}
                                                            formTitleAriaLabel={formTitleAriaLabel}
                                                        />
                                                    )}
                                            </React.Fragment>
                                        )
                                    })}

                                    <Button
                                        variant="outline"
                                        border="1px dashed"
                                        borderColor="gray.200"
                                        color="blue.600"
                                        height={['44px', '44px', '167px']}
                                        rounded="base"
                                        fontWeight="medium"
                                        leftIcon={<PlusIcon boxSize={'15px'} />}
                                        onClick={toggleAddressEdit}
                                    >
                                        <FormattedMessage
                                            defaultMessage="Add New Address"
                                            id="shipping_address_selection.button.add_address"
                                        />
                                        {/*Arrow up icon pointing to the new address that is being added*/}
                                        {isEditingAddress && !selectedAddressId && (
                                            <Box
                                                width={3}
                                                height={3}
                                                borderLeft="1px solid"
                                                borderTop="1px solid"
                                                borderColor="blue.600"
                                                position="absolute"
                                                left="50%"
                                                bottom="-23px"
                                                background="white"
                                                transform="rotate(45deg)"
                                            />
                                        )}
                                    </Button>
                                </SimpleGrid>
                            </RadioCardGroup>
                        )}
                    />
                )}

                {(customer?.isGuest ||
                    (isEditingAddress && !selectedAddressId) ||
                    isBillingAddress) && (
                    <ShippingAddressEditForm
                        title={formatMessage({
                            defaultMessage: 'Add New Address',
                            id: 'shipping_address_selection.title.add_address'
                        })}
                        hasSavedAddresses={hasSavedAddresses}
                        toggleAddressEdit={toggleAddressEdit}
                        hideSubmitButton={hideSubmitButton}
                        form={form}
                        isBillingAddress={isBillingAddress}
                        submitButtonLabel={submitButtonLabel}
                        formTitleAriaLabel={formTitleAriaLabel}
                    />
                )}

                {customer.isRegistered && !isEditingAddress && !hideSubmitButton && (
                    <Box pt={2}>
                        <Container variant="form">
                            <Button
                                type="submit"
                                width="full"
                                disabled={!form.formState.isValid || form.formState.isSubmitting}
                            >
                                {formatMessage(submitButtonLabel)}
                            </Button>
                        </Container>
                    </Box>
                )}
            </Stack>
        </form>
    )
}

ShippingAddressSelection.propTypes = {
    /** The form object returned from `useForm` */
    form: PropTypes.object,

    /** Optional address to use as default selection */
    selectedAddress: PropTypes.object,

    /** Override the submit button label */
    submitButtonLabel: MESSAGE_PROPTYPE,

    /** aria label to use for the address group */
    formTitleAriaLabel: MESSAGE_PROPTYPE,

    /** Show or hide the submit button (for controlling the form from outside component) */
    hideSubmitButton: PropTypes.bool,

    /** Callback for form submit */
    onSubmit: PropTypes.func,

    /** Optional flag to indication if an address is a billing address */
    isBillingAddress: PropTypes.bool
}

export default ShippingAddressSelection
